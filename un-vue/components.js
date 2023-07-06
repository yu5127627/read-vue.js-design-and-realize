// 全局变量 储存当前正在被初始化的实例
let currentInstance = null;

// 注册全局初始化的实例
function setCurrentInstance(instance) {
  currentInstance = instance;
}

function renderComponent(oNode, nNode, container, anchor) {
  if (!oNode) {
    // 挂载组件
    mountComponent(nNode, container, anchor);
  } else {
    // 更新组件
    patchComponent(oNode, nNode, anchor);
  }
}

// 解析子组件的 props 和 attrs 数据
function resolveProps(options = {}, propsData = {}) {
  const props = {};
  const attrs = {};
  // 遍历为组件传递的 props 数据
  for (const key in propsData) {
    // 以字符串 on 开头的 props，不论情况一律添加到 props 中
    if (key in options || key.startsWith('on')) {
      // 根据子组件定义的 props 过滤出接受传递的 props[key]
      props[key] = propsData[key];
    } else {
      // 否则将其当作 attrs
      attrs[key] = propsData[key];
    }
  }
  return [props, attrs]
}

// 检查 props 是否需要更新
function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps);
  // 新旧 props 数量不同，说明有变化
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    // 新旧不想等的 props, 说明有变化
    if (nextProps[key] !== prevProps[key]) return true
  }
  return false
}

// 更新组件
function patchComponent(oNode, nNode, anchor) {
  // 获取组件实例，即旧组件实例，同时也让新的组件 vnode 也指向组件实例
  const instance = (nNode.component = oNode.component);
  // 获取当前的 props 数据
  const { props } = instance;
  // 检查 props 是否发生变化，没有变化不需要更新
  if (hasPropsChanged(oNode.props, nNode.props)) {
    // 重新获取 props 数据
    const [nextProps] = resolveProps(nNode.type.props, nNode.props);
    // 更新 props
    for (const key in nextProps) {
      props[key] = nextProps[key];
    }
    // 删除旧的、不存在的 props
    for (const key in props) {
      if (!(key in nextProps)) delete props[key]
    }
  }
}
