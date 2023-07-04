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
  // 设置元素属性
  patchProps(el, key, prevValue, nextValue) {
    // 对 class 进行特殊处理
    if (key === 'class') {
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