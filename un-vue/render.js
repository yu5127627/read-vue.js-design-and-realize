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

for (const key in elementApi) {
  window[key] = elementApi[key];
}

function patchElement(oNode, nNode) {
  const el = nNode.el = oNode.el;
  const oldProps = oNode.props;
  const newProps = nNode.props;

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

// 求解给定序列的最长递增子序列
function getSequence(arr) {
  const p = arr.slice()
  const result = [0]; let i, j, u, v, c; const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue
      }
    }
    u = 0;
    v = result.length - 1;
    while (u < v) {
      c = ((u + v) / 2) | 0;
      if (arr[result[c]] < arrI) {
        u = c + 1;
      } else {
        v = c;
      }
    }
    if (arrI < arr[result[u]]) {
      if (u > 0) {
        p[i] = result[u - 1];
      }
      result[u] = i;
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

function patchKeyedChildren(oNode, nNode, container) {
  const oldChildren = oNode.children;
  const newChildren = nNode.children;

  // 处理相同的前置节点
  // 索引 j 指向新旧两组子节点的开头
  let j = 0;
  let oldVNode = oldChildren[j];
  let newVNode = newChildren[j];
  // while 循环向后遍历，直到遇到 key 不同的节点为止
  while (oldVNode.key === newVNode.key) {
    // 打补丁
    patch(oldVNode, newVNode, container);
    j++;  // 索引递增
    oldVNode = oldChildren[j];
    newVNode = newChildren[j];
  }

  // 更新相同的后置节点
  let oldEnd = oldChildren.length - 1;
  let newEnd = newChildren.length - 1;
  oldVNode = oldChildren[oldEnd];
  newVNode = newChildren[newEnd];
  // while 循环从后向前遍历，直到遇到拥有不同 key 值的节点为止
  while (oldVNode.key === newVNode.key) {
    patch(oldVNode, newVNode, container);
    oldEnd--;
    newEnd--;
    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];
  }

  // 新增节点
  // 预处理完毕之后，如果满足以下条件，则说明 j--> newEnd 之间的节点应作为新节点插入
  if (j > oldEnd && j <= newEnd) {
    const anchorIndex = newEnd + 1;
    const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
    while (j <= newEnd) {
      patch(null, newChildren[j++], container, anchor);
    }
  }

  if (j > oldEnd && j <= newEnd) {

  } else if (j > newEnd && j <= oldEnd) {
    // j--> oldEnd 之间的节点都应该被卸载
    while (j <= oldEnd) {
      unmount(oldChildren[j++]);
    }
  } else {
    // 构造 source 数组
    const count = newEnd - j + 1;
    // 新的一组子节点中剩余为处理节点的数量
    const source = new Array(count);
    source.fill(-1);

    // oldStart、newStart 分别为起始索引 j
    const oldStart = j;
    const newStart = j;
    let moved = false;
    let pos = 0;

    // 构建索引表
    const keyIndex = {};
    for (let i = newStart; i <= newEnd; i++) {
      keyIndex[newChildren[i].key] = i;
    }

    // 代表更新过的节点数量
    let patched = 0;
    // 遍历旧的一组子节点中剩余未处理的节点
    for (let i = oldStart; i <= oldEnd; i++) {
      oldVNode = oldChildren[i];
      // 如果更新过的节点数量 <= 需要更新的节点数量
      if (patched <= count) {
        // 通过是索引表快速找到新的一组子节点中具有相同 key 值的节点位置
        const k = keyIndex[oldVNode.key];
        if (typeof k !== "undefined") {
          newVNode = newChildren[k];
          patch(oldVNode, newVNode, container);
          // 更新后 patched 递增
          patched++;
          // 填充 source 数组
          source[k - newStart] = i;
          // 判断节点是否需要移动
          if (k < pos) {
            moved = true;
          } else {
            pos = k;
          }
        } else {
          // 没找到
          unmount(oldVNode);
        }
      } else {
        // 如果更新过的节点数量大于需要更新的节点数量，则卸载多余的节点
        unmount(oldVNode)
      }
    }

    // 触发 dom 移动
    if (moved) {
      const seq = getSequence(source);  // 计算最长递增子序列
      // s 指向最长递增子序列的最后一个元素
      let s = seq.length - 1;
      // i 指向新的一组子节点的最后一个元素
      let i = count - 1;
      //
      for (i; i >= 0; i--) {
        if (source[i] === -1) {
          // 说明索引为 i 的节点是全新的节点，应该将其挂载
          const pos = i + newStart;   // 该节点在新的 children 中的真实位置索引
          const newVNode = newChildren[pos];
          // 该节点的下一个节点的位置索引
          const nextPos = pos + 1;
          // 锚点
          const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
          // 挂载
          patch(null, newVNode, container, anchor);
        } else if (i !== seq[s]) {
          // 如果节点的索引 i 不等于 seq[s] 的值，说明该节点需要移动
          const pos = i + newStart;   // 该节点在新的 children 中的真实位置索引
          const newVNode = newChildren[pos];
          // 该节点的下一个节点的位置索引
          const nextPos = pos + 1;
          // 锚点
          const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
          // 挂载
          insert(newVNode.el, container, anchor);
        } else {
          // 当 i === seq[s] 时，说明该位置的节点不需要移动，只需要让 s 指向下一个位置
          s--;
        }
      }
    }
  }
}

function patchChildren(oNode, nNode, container) {
  // 判断子节点的类型是否为文本节点
  if (typeof nNode.children === "string" || typeof nNode.children === "number") {
    // 旧子节点的类型有三种可能：没有子节点、文本子节点以及一组子节点
    // 只有当旧子节点为一组子节点时，才需要逐个卸载，其他情况下的什么都不需要做
    if (Array.isArray(oNode.children)) {
      oNode.children.forEach(v => unmount(v));
    }
    // 最后将新的文本节点内容设置给容器元素
    console.log('setElementText', nNode);
    setElementText(container, nNode.key ? nNode.children + ` _ key ${nNode.key}` : nNode.children);
  } else if (Array.isArray(nNode.children)) {
    patchKeyedChildren(oNode, nNode, container);
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
  console.log(`----- patch oldTag: ${oNode.type}, newTag: ${nNode.type} -------------------`);
}

function createRenderer(options) {
  const { createElement, setElementText, patchProps, createComment, createText, setText, insert } = options;

  // 挂载 vnode 到 container
  function mountElement(vnode, container, anchor) {
    const el = vnode.el = createElement(vnode.type);

    if (typeof vnode.children === 'string' || typeof vnode.children === 'number') {
      setElementText(el, vnode.key ? vnode.children + ` _ key ${vnode.key}` : vnode.children);
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

    // 判断一个 vnode 是否需要过渡
    const needTransition = vnode.transition;
    if (needTransition) {
      vnode.transition.beforeEnter(el);
    }
    insert(el, container, anchor);
    if (needTransition) {
      vnode.transition.enter(el);
    }
    console.log(`--------------------- mount tag: ${vnode.type}-------------------`);
  }



  // 更新 vnode-children
  patchChildren = patchChildren;

  // 更新 vnode
  patchElement = patchElement;


  // 卸载 vnode
  function unmount(vnode) {
    // 判断 vnode 是否需要过渡处理
    const needTransition = vnode.transition;

    // 处理自定义 Fragment 类型的 vnode,只需要卸载其 children
    if (vnode.type === Fragment) {
      vnode.children.forEach(v => unmount(v));
      return
    } else if (typeof vnode.type === 'object') {
      // unode.shouldKeepAlive 是一个布尔值，用来标识该组件是否应该被 KeepAlive
      if (vnode.shouldKeepAlive) {
        // 对于需要被 KeepAlive 的组件，不应该卸载它
        // KeepAlive 组件的 _deActivate() 使其激活
        vnode.keepAliveInstance._deActivate(vnode);
      } else {
        // 对于组件的卸载，本质上是要卸载组件所渲染的内容，即 subTree
        unmount(vnode.component.subTree);
      }
      return
    }
    const parent = vnode.el.parentNode;
    if (parent) {
      // 将卸载动作封装到 performRemove 函数用作参数传递
      const performRRemove = () => parent.removeChild(vnode.el);

      if (needTransition) {
        vnode.transition.leave(vnode.el, performRRemove);
      } else {
        parent.removeChild(vnode.el);
      }
    }
  }

  // 挂载 or 打补丁 到 container
  function patch(oNode, nNode, container, anchor) {
    // 如果 onode  存在，对比 onode 和 nnode 的类型
    if (oNode && oNode.type !== nNode.type) {
      // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
      unmount(oNode);
      console.log(`--------------------- unmount tag: ${oNode.type}-------------------`);
      oNode = null;
    }
    // 运行到此处 说明新旧节点类型相同
    const { type } = nNode;
    if (typeof type === 'string') {
      // 不存在 oNode，意味着挂载，调用 mountElement() 完成挂载
      if (!oNode) {
        mountElement(nNode, container, anchor);
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
    } else if (typeof type === 'object' && type.__isTeleport) {
      // 组件中存在 __isTeleport 标识，说明是 Teleport 组件
      // 调用 Teleport 组件选项中的 process 函数将控制权交接出去
      // 传递给 process 函数的第五个参数是渲染器的一些内部方法
      type.process(oNode, nNode, container, anchor, {
        patch, patchChildren, unmount,
        move(vnode, container, anchor) {
          elementApi.insert(
            vnode.component ? vnode.component.subTree.el : vnode.el, // 移动组件 or 移动普通元素
            container, anchor
          )
        }
      })
    } else if (typeof type === 'object' || typeof type === 'function') {
      // 如果 nNode.type 的值的类型是对象，则它描述的是组件
      // 如果 nNode.type 的值的类型是函数，则它描述的是函数式组件
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

  window.unmount = unmount;
  window.patchChildren = patchChildren;
  window.patch = patch;
  window.patchElement = patchElement;
  return {
    render,
    hydrate
  }
}