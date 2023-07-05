const Text = Symbol();  // 定义文本节点
const Comment = Symbol();   // 定义注解节点
const Fragment = Symbol();  // 定义 Fragment 节点 (vue3 支持多跟节点的原理)

// 序列化 class
function normalizeClass(value) {
  let res = ''
  if (typeof value === 'string') {
    res = value
  } else if (Array.isArray(value)) {
    // 👉遍历递归处理
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    // 👉将对象转化为string
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

// 判断是否应该作为 DOM Properties 设置
function shouldSetAsProps(el, key, value) {
  // 特殊处理
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底
  return key in el
}

// 抽离平台 api
const elementApi = {
  // 用于创建元素
  createElement(tag) {
    return document.createElement(tag)
  },
  // 设置元素的文本节点
  setElementText(el, text) {
    el.textContent = text;
  },
  // 在指定 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
  },
  // 创建文本节点
  createText(text) {
    return document.createTextNode(text);
  },
  // 创建注释节点
  createComment(text) {
    return document.createComment(text);
  },
  // 设置文本 or 注释节点
  setText(el, text) {
    el.nodeValue = text;
  },
  // 设置元素属性
  patchProps(el, key, prevValue, nextValue) {
    // 匹配以 on 开头的属性，视作事件
    if (/^on/.test(key)) {
      // 根据属性名称得到对应的事件名称 onClick => click
      const name = key.slice(2).toLowerCase();
      // 定义 el._vei 为一个对象，存在事件名称到事件处理函数的映射
      const invokers = el._vei || (el._vei = {});
      // 根据事件名称获取 invoker
      let invoker = invokers[key];
      if (nextValue) {
        if (!invoker) {
          // 将事件处理函数缓存到 el._vei[key]下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e));
            } else {
              invoker.value(e);
            }
          }
          invoker.value = nextValue;
          // 储存事件处理函数被绑定的时间
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker);
      }
      el.addEventListener(name, nextValue);
    } else if (key === 'class') {
      // 对 class 进行特殊处理
      el.className = normalizeClass(nextValue) || '';
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 判断是否应该作为 DOM Properties 设置
      const type = typeof el[key];
      if (type === 'boolean' && nextValue === '') {
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      // 如果要设置的属性没有对应的 dom properties，则使用 setAttribute 设置属性
      el.setAttribute(key, nextValue);
    }
  }
}