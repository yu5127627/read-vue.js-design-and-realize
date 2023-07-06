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

function createRenddderer(options) {
  const { createElement, setElementText, patchProps, createComment, createText, setText, insert } = options;

  // 挂载 vnode 到 container
  function mountElement(vnode, container) {
    const el = vnode.el = createElement(vnode.type);
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 多个子节点，遍历用 patch 挂载它们
      vnode.children.forEach(child => {
        patch(null, child, el);
      })
    }

    // 处理 props
    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key]);
      }
    }

    insert(el, container);
  }

  // 更新 vnode-children
  function patchChildren(oNode, nNode, container) {
    // 判断子节点的类型是否为文本节点
    if (typeof nNode.children === "string") {
      // 旧子节点的类型有三种可能：没有子节点、文本子节点以及一组子节点
      // 只有当旧子节点为一组子节点时，才需要逐个卸载，其他情况下的什么都不需要做
      if (Array.isArray(oNode.children)) {
        oNode.children.forEach(v => unmount(v));
      }
      // 最后将新的文本节点内容设置给容器元素
      setElementText(container, nNode.children);
    } else if (Array.isArray(nNode.children)) {
      // 说明新子节点是一组子节点
      // 判断旧子节点是否也是一组子节点
      if (Array.isArray(oNode.children)) {
        // 运行到此处 说明新旧子节点都是一组子节点。
        // 此处开始核心的 diff 算法

        // 旧节点全部卸载
        oNode.children.forEach(v => unmount(v));
        // 新节点全部挂载
        nNode.children.forEach(v => patch(null, v, container));

      } else {
        // 旧子节点要么是文本子节点 要么不存在
        // 但无论哪种情况，我们只需要将容器清空，然后将新的一组子节点逐个挂载
        setElementText(container, '');
        nNode.children.forEach(c => patch(null, c, container))
      }
    } else {
      // 新子节点不存在，旧子节点是一组子节点，只需逐个卸载即可
      if (Array.isArray(oNode.children)) {
        oNode.children.forEach(v => unmount(v));
      } else if (typeof oNode.children === 'string') {
        // 旧子节点是文本子节点，清空内容即可
        setElementText(container, '');
      }
      // 没有子节点 没有操作
    }
  }

  // 更新 vnode
  function patchElement(oNode, nNode) {
    const el = nNode.el = oNode.el;
    const oldProps = oNode.props;
    const newProps = nNode.props;
    // 更新 props 为新 value
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }
    // 更新 props 为 null
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null);
      }
    }
    // 更新 children
    patchChildren(oNode, nNode, el);
  }

  // 卸载 vnode
  function unmount(vnode) {
    // 处理自定义 Fragment 类型的 vnode,只需要卸载其 children
    if (vnode.type === Fragment) {
      vnode.children.forEach(v => unmount(v));
      return
    }
    const parent = vnode.el.parentNode;
    if (parent) {
      parent.removeChild(vnode.el);
    }
  }

  // 挂载 or 打补丁 到 container
  function patch(oNode, nNode, container, anchor) {
    // 如果 onode  存在，对比 onode 和 nnode 的类型
    if (oNode && oNode.type !== nNode.type) {
      // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
      unmount(oNode);
      oNode = null;
    }
    // 运行到此处 说明新旧节点类型相同
    const { type } = nNode;
    if (typeof type === 'string') {
      // 不存在 oNode，意味着挂载，调用 mountElement() 完成挂载
      if (!oNode) {
        mountElement(nNode, container);
      } else {
        // oNode 存在，意味着打补丁，即更新内容
        patchElement(oNode, nNode);
      }
    } else if (type === Text || type === Comment) {
      // 插入注释节点 || 文本节点
      if (!oNode) {
        if (type === Text) {
          nNode.el = createText(nNode.children);
        } else if (type === Comment) {
          nNode.el = createComment(nNode.children);
        }
        const el = nNode.el;
        insert(el, container)
      } else {
        const el = nNode.el = oNode.el;
        if (nNode.children !== oNode.children) {
          setText(el, nNode.children);
        }
      }
    } else if (type === Fragment) {
      if (!oNode) {
        // 如果旧 vnode 不存在，只需要将 children 逐个挂载
        nNode.children.forEach(v => patch(null, v, container))
      } else {
        // 如果旧 vnode 存在，则只需要更新 children vnode
        patchChildren(oNode, nNode, container);
      }
    } else if (typeof type === 'object') {
      // 如果 nNode.type 的值的类型是对象，则它描述的是组件
      renderComponent(oNode, nNode, container, anchor);
    } else if (type === 'xxx') {
      // 处理其他类型的 vnode
    }
  }

  // 渲染 vnode 到 container
  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行更新
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新 vnode 不存在，说明是卸载 unmount 操作
        unmount(container._vnode);
      }
    }
    // 储存 vnode 
    container._vnode = vnode;
  }

  function hydrate(vnode, container) { }

  window.patch = patch;
  return {
    render,
    hydrate
  }
}