// 储存副作用函数
const bucket = new WeakMap();
const ITERATE_KEY = Symbol();
// 用一个全局变量储存被注册的副作用函数
let activeEffect;
// effect 栈
const effectStack = [];
// 定义一个 Map 实例，储存原始对象到代理对象的映射
const reactiveMap = new Map();
// 一个标记变量，代表是否进行追踪。默认允许追踪
let shouldTrack = true;
const arrayInstrumentations = {};
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