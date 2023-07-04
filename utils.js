// 储存副作用函数
const bucket = new WeakMap();
const ITERATE_KEY = Symbol();
const MAP_KEY_ITERATE_KEY = Symbol(); // .keys() 读取 key 的唯一值
// 用一个全局变量储存被注册的副作用函数
let activeEffect;
// effect 栈
const effectStack = [];
// 定义一个 Map 实例，储存原始对象到代理对象的映射
const reactiveMap = new Map();
// 一个标记变量，代表是否进行追踪。默认允许追踪
let shouldTrack = true;
// 数组方法的重写
const arrayInstrumentations = {};
// 迭代器方法的重写
function iterationMethod() {
  const target = this.raw;
  const result = target[Symbol.iterator]();
   // 将可代理的值转换为响应式数据
  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val;
  track(target, ITERATE_KEY);
  // 自定义返回的迭代器
  return {
    next() {
      // 调用原始迭代器的 next 方法获取 value 和 done
      const { value,done } = result.next();
      return {
        // 如果 value 不是 undefined,则对其进行包裹
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
};
// keys values 迭代器方法重写
function valuesIterationMethod() {
  const target = this.raw;
  const result = target.values();
  // 将可代理的值转换为响应式数据
  const wrap = (val) => typeof val === 'object' ? reactive(val) : val;
  track(target, ITERATE_KEY);
  // 自定义返回的迭代器
  return {
    next() {
      // 调用原始迭代器的 next 方法获取 value 和 done
      const { value,done } = result.next();
      return {
        // 如果 value 不是 undefined,则对其进行包裹
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}
function keysIterationMethod() {
  const target = this.raw;
  const result = target.keys();
  // 将可代理的值转换为响应式数据
  const wrap = (val) => typeof val === 'object' ? reactive(val) : val;
  track(target, MAP_KEY_ITERATE_KEY);
  // 自定义返回的迭代器
  return {
    next() {
      // 调用原始迭代器的 next 方法获取 value 和 done
      const { value,done } = result.next();
      return {
        // 如果 value 不是 undefined,则对其进行包裹
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}
// Set Map 数据方法的重写
const mutableInstrumentations = {
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod,
  forEach(callback, thisArg) {
    const target = this.raw;
    track(target, ITERATE_KEY)
     // 将可代理的值转换为响应式数据
    const wrap = (val) => typeof val === 'object' ? reactive(val) : val;
    // 通过原始数据对象调用 forEach，并把 callback 传递过去
    target.forEach((v, k) => {
      // 通过 .call 调用 callback, 并传递 thisArg
      // 用 wrap 函数包裹 value 和 key 后再传递给 callback, 这样就实现了深响应
      callback.call(thisArg, wrap(v), wrap(k), this);
    });
  },
  get(key) {
    const target = this.raw;
    const hasKey = target.has(key);
    track(target, key);
    if(hasKey) {
      const result = target.get(key);
      return typeof result === 'object'?reactive(result):result
    }
  },
  set(key,value) {
    const target = this.raw;
    const hasKey = target.has(key);
    const oldValue = target.get(key);
    // 获取原始数据，确保不设置响应式数据
    const rawValue = value.raw || value;
    target.set(key, rawValue);
    if(!hasKey) {
      trigger(target, key, 'ADD');
    } else if(oldValue!==value || (oldValue === oldValue && value === value)){
      // 如果不存在，并且值变了，则是 SET 类型的操作，意味着修改
      trigger(target,key,'SET');
    }
  },
  add(key) {
    // 获取原始数据对象
    const target = this.raw;
    // 先判断值是否已经存在
    const hasKey = target.has(key);
    // 通过原始数据对象执行 add 方法添加具体的值
    const result = target.add(key);
    // 只有当值不存在的情况下，才需要触发响应
    if(!hasKey) {
      // 触发副作用函数响应，并指定操作类型为 ADD
      trigger(target,key,'ADD');
    }
    // 返回操作结果
    return result
  },
  delete(key) {
    // 获取原始数据对象
    const target = this.raw;
    // 先判断值是否已经存在
    const hasKey = target.has(key);
    // 通过原始数据对象执行 delete 方法删除具体的值
    const result = target.delete(key);
    // 只有当要删除的值存在时，才需要触发响应
    if(hasKey) {
      // 触发副作用函数响应，并指定操作类型为 DELETE
      trigger(target, key, 'DELETE');
    }
    // 返回操作结果
    return result
  }
};
// 修改数据的查找方法
['includes','indexOf','lastIndexOf'].forEach(method=>{
  arrayInstrumentations[method] = function(...args) {
    const originMethod = Array.prototype[method];
    // this 是代理对象，先在代理对象中查找，将结果储存到 result 中
    let result = originMethod.apply(this,args);
    if(result===false) {
      // result 为 false 说明没找到，通过 this.raw 拿到原始数组，再去其中查找，并更新 result 值
      result = originMethod.apply(this.raw,args);
    }
    return result
  }
});
// 修改数组隐式修改长度的方法
['push','pop','shift','unshift','splice'].forEach(method => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function(...args) {
      // 在调用原始方法之前，禁止追踪
      shouldTrack = false;
      // push 方法的默认行为
      let result = originMethod.apply(this, args);
      // 在调用原始方法之后，回复原先的习惯为，即允许追踪
      shouldTrack = true;
      return result
    }
});

// 深只读
function readonly(obj) {
  return createReactive(obj, false, true);
}
// 浅只读
function shoallowReadonly(obj) {
  return createReactive(obj, true, true);
}
// 深响应
function reactive(obj) {
  // 优先通过原始对象 obj 寻找之前创建的代理对象
  const existionProxy = reactiveMap.get(obj);
  // 如果存在，直接返回已有的代理对象
  if(existionProxy) return existionProxy
  // 创建新的代理对象
  const proxy = createReactive(obj);
  // 储存到 Map 中，避免重复创建
  reactiveMap.set(obj,proxy);
  return proxy;
}
// 浅响应
function shallowReactive(obj) {
  return createReactive(obj, true);
}

// effect 函数用于注册副作用函数
function effect(fn, options = {}) {
  const effectFn = () => {
    // 调用 cleanup 函数完成清除工作
    cleanup(effectFn);
    // 当 effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn);
    const result = fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return result;
  }
  // 将 options 挂载到 effectFn 上
  effectFn.options = options;
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 只有 非lazy 的时候，才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }
  // 将副作用函数作为返回值返回
  return effectFn
}

// 清除遗留的副作用函数
function cleanup(effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i];
    // 将 effectFn 从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0;
}

function computed(fn) {
  // value 用来缓存上一次计算的值
  let value;
  // dirty 标志，用来标识是否需要重新计算，为 true 则意味着‘脏’，需要计算
  let dirty = true;
  // 把 fn 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(fn, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 重置 true
    scheduler() {
      dirty = true;
      // 当计算属性依赖的响应式数据变化时，手动调用 trigger 函数触发响应
      trigger(obj, 'value');
    }
  });
  const obj = {
    // 当读取 value 时才执行 effectFn
    get value() {
      // 只有‘脏’时才计算值，并将得到的值缓存到 value 中
      if (dirty) {
        value = effectFn();
        // 将 dirty 设置为 false，下一次访问直接使用缓存到 value 中的值
        dirty = false;
      }
      // 当读取 value 时，手动调用 track 函数进行追踪
      track(obj, 'value');
      return value;
    }
  }
  return obj
}

function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值 或者已经被读取过了 那么什么都不做
  if (typeof value != "object" || value === null || seen.has(value)) return
  // 将数据添加到 seen 中，代表遍历的读取过了，避免循环引用引起的死循环
  seen.add(value);
  // 暂时不考虑数组及其他结构
  // 假设 value 是一个对象，读取每一个值，递归调用 traverse 进行处理
  for (const key in value) {
    traverse(value[key], seen);
  }
  return value
}

// watch 函数接收两个参数，source 是响应式数据，cb 是回调函数
function watch(source, cb, options = {}) {
  // 定义 getter
  let getter;
  // 如果 source 是函数，说明用户传递的是 getter, 所以直接把 source 赋值给 getter
  if (typeof source === 'function') {
    getter = source;
  } else {
    // 否则继续  调用 traverse 递归的读取
    getter = () => traverse(source);
  }
  // 定义旧值与新值
  let oldValue, newValue;

  // cleanup 用来储存用户注册的过期回调
  let cleanup;
  function onInvalidate(fn) {
    // 将过期回调储存到 cleanup 中
    cleanup = fn;
  }

  // 提取 scheduler 调度函数为一个独立的 job 函数
  const job = () => {
    newValue = effectFn();
    // 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) {
      cleanup();
    }
    // 添加 onInvalidate 作为回调函数的第三个参数，以便用户使用
    cb(newValue, oldValue, onInvalidate);
    oldValue = newValue;
  }

  // 注册副作用函数，开启 lazy 函数，并把返回值储存到  effectFn 中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      // 使用 job 函数作为调度器函数
      scheduler: () => {
        // 在调度函数中判断 flush 是否为 post，是则以微任务队列执行
        if (options.flush === 'post') {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      }
    }
  )

  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发回调执行
    job();
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}