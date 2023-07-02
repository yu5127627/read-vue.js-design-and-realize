// 储存副作用函数
const bucket = new WeakMap();
const ITERATE_KEY = Symbol();
// 用一个全局变量储存被注册的副作用函数
let activeEffect;
// effect 栈
const effectStack = [];

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
  return createReactive(obj);
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