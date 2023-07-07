// 全局变量 储存当前正在被初始化的实例
let currentInstance = null;

// 注册全局初始化的实例
function setCurrentInstance(instance) {
  currentInstance = instance;
}

function onMounted(fn) {
  if (currentInstance) {
    currentInstance.mounted.push(fn);
  } else {
    console.error('onMounted 函数只能在 setup 中调用');
  }
}

function renderComponent(oNode, nNode, container, anchor) {
  if (!oNode) {
    if (nNode.keptAlive) {
      // 如果该组件已经被 keepAlive，不会重新挂载，而是会调用方法来激活它
      nNode.keepAliveInstance._activate(nNode, container, anchor);
    } else {
      // 挂载组件
      mountComponent(nNode, container, anchor);
    }
  } else {
    // 更新组件
    patchComponent(oNode, nNode, anchor);
  }
}

// 挂载组件
function mountComponent(vnode, container, anchor) {
  // 检查是否是函数式组件
  const isFunctional = typeof vnode.type === 'function';
  // 获取组件选项对象
  let componentOptions = vnode.type;

  if (isFunctional) {
    // 如果是函数式组件，则将 vnode.type 作为渲染函数
    componentOptions = {
      render: vnode.type,
      props: vnode.type.props
    }
  }
  // 获取组件的 render 函数
  let { render, data, setup, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions;

  // 1.此处调用 beforeCreate 钩子
  beforeCreate && beforeCreate();
  // 获取组件数据，并转换为响应式数据
  const state = data ? reactive(data()) : null;
  // 解析目标的 props 数据与 attrs 数据
  const [props, attrs] = resolveProps(propsOption, vnode.props);

  // 使用编译好的 vnode.children 作为 slots 对象
  const slots = vnode.children || {};
  // 定义组件实例，本质上就是一个对象。储存着与组件有关的状态信息
  const instance = {
    state,  // 组件自身的数据，即 data
    props: shallowReactive(props),  // 将解析出的 porps 转换为浅响应式并储存到组件实例
    isMounted: false,   // 标识组件是否被挂载，初始值为 false
    subTree: null,   // 组件渲染的 vnode
    slots,   // 将插槽添加到组件实例上
    mounted: [], // 储存通过 onMounted 函数注册的生命周期钩子函数
    unmounted: [], // 储存通过 onUnmounted 函数注册的生命周期钩子函数
    keepAliveCtx: null, // 只有 KeepAlive 组件的实例下会有 keepAliveCtx 属性
  }

  // 检查当前要挂载的组件是否是 keepAlive 组件
  const isKeepAlive = vnode.type.__isKeepAlive;
  if (isKeepAlive) {
    // 在 KeepAlive 组件实例上添加 keepAliveCtx 对象
    instance.keepAliveCtx = {
      // 移动 vnode
      move(vnode, container, anchor) {
        // 本质上是将组件渲染的内容移动到指定容器中，即隐藏容器中
        insert(vnode.component.subTree.el, container, anchor);
      },
      createElement(tag) {
        return elementApi.createElement(tag)
      }
    }
  }

  function emit(event, ...payload) {
    const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
    const handler = instance.props[eventName];
    if (handler) {
      handler(...payload)
    } else {
      console.log('事件不存在');
    }
  }

  // setup 上下文内容
  const setupContext = { attrs, emit, slots };
  // 调用 setup 之前，设置当前组件实例
  setCurrentInstance(instance);
  // 获取 setup 返回值，props 为只读作为第一个参数传递，setupContext 作为第二个参数传递
  const setupResult = setup ? setup(shallowReadonly(instance.props), setupContext) : null;
  // 调用 setup 之后，重置当前组件实例
  setCurrentInstance(null);
  // 用作储存 setup 返回的数据
  let setupState = null;
  // 如果 setup 函数的返回值是函数，则将其作为渲染函数
  if (typeof setupResult === 'function') {
    if (render) {
      console.log('setup 函数返回 render 函数，render 选项将被忽略');
    }
    // 将 setupResult 作为渲染函数
    render = setupResult
  } else {
    // 如果 setup 返回值不是函数，则作为数据状态赋值给 setupSate
    setupState = setupResult
  }

  // 将组件实例储存到 vnode 上，用于后续更新
  vnode.component = instance;

  // 创建渲染上下文对象，本质上是组件实例的代理
  const renderContext = new Proxy(instance, {
    get(t, k, r) {
      // 取得组件自身状态与 props 数据
      const { state, props, slots } = t;
      // 单独处理 $slot 
      if (k === '$slots') return slots
      // 先尝试读取自身状态数据
      if (state && k in state) {
        return state[k]
      } else if (k in props) {
        // 组件自身没有 尝试从 props 中读取
        return props[k]
      } else if (setupState && k in setupState) {
        // 增加对 setupState 的支持
        return setupState[k]
      } else {
        console.log('不存在');
      }
    },
    set(t, k, v, r) {
      const { state, props } = t;
      if (state && k in state) {
        state[k] = v;
      } else if (k in props) {
        console.log(`attemppting to mutate prop "${k}".props are readonly`);
      } else if (setupState && k in setupState) {
        // 增加对 setupState 的支持
        return setupState[k] = v;
      } else {
        console.log('不存在');
      }
    }
  })

  // 2.此处调用 created 钩子
  // 调用时绑定渲染上下文对象
  created && created.call(renderContext);

  // 自更新：将组件的 render 函数调用设置为副作用函数
  effect(() => {
    // 执行渲染函数，获取组件要渲染的内容，即 render 函数返回的 vnode
    const subTree = render ? render.call(renderContext, renderContext) : {};
    // 检查组件是否已经被挂载
    if (!instance.isMounted) {
      // 3.此处调用 beforeMount 钩子
      beforeMount && beforeMount.call(renderContext);

      // 初次挂载
      if (Array.isArray(subTree)) {
        for (const tree of subTree) {
          patch(null, tree, container, anchor);
        }
      } else {
        patch(null, subTree, container, anchor);
      }

      // 更新组件的挂载状态
      instance.isMounted = true;

      // 4.此处调用 mounted 钩子
      mounted && mounted.call(renderContext);
      // 遍历 instance.mounted 数组并逐个执行
      instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext));
    } else {
      // 5.此处调用 beforeUpdate 钩子
      beforeUpdate && beforeUpdate.call(renderContext);

      // 组件已经被挂载  执行更新
      patch(instance.subTree, subTree, container, anchor);

      // 遍历 instance.unmounted 数组并逐个执行
      instance.unmounted && instance.unmounted.forEach(hook => hook.call(renderContext));

      // 6.此处调用 updated 钩子
      updated && updated.call(renderContext);
    }
    // 储存组件的当前 vnode,，用作对比更新
    instance.subTree = subTree;
  }, {
    // 指定该副作用函数的调度器为 queueJob
    scheduler: queueJob
  })
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
function hasPropsChanged(prevProps = {}, nextProps = {}) {
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

// 定义一个异步组件
function defineAsyncComponent(options) {
  // options 可以是配置项，也可以是加载器
  if (typeof options === 'function') {
    // 如果 options 是加载器，则将其格式化为配置项形式
    options = { loader: options };
  }
  const { loader } = options;
  // 用作储存异步加载的组件
  let InnerComp = null;
  // 记录重试次数
  let retries = 0;
  // 封装 load 函数用作加载异步组件
  function load() {
    return loader()
      // 如果用户指定了 onError 回调，则将控制权交给用户
      .catch((err) => {
        // 返回一个新的 promise 实例
        if (options.onError) {
          return new Promise((resolve, reject) => {
            // 重试
            const retry = () => {
              resolve(load());
              retries++
            }
            // 失败
            const fail = () => reject(err)
            // 作为 onError 回调函数的参数，让用户决定下一步怎么做
            options.onError(retry, fail, retries)
          })
        } else {
          throw error
        }
      })
  }

  // 返回一个包装组件
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 异步组件加载状态标识
      const loaded = ref(false);
      const loading = ref(false); // loading 加载中状态标识
      const error = shallowRef(null); // 定义 error, 当错误发生，储存错误对象

      let loadingTimer = null;
      // 如果配置项中存在 delay,则开启一个定时器计时，当延迟到时后将 loading.value 设置为 true
      if (options.delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true;
        }, options.delay);
      } else {
        // 如果配置项中没有 delay,直接标记为加载中
        loading.value = true;
      }
      // 运行加载器
      load()
        .then(c => {
          // 组件赋值
          InnerComp = c;
          // 更改加载状态
          loader.value = true;
        })
        .catch(((err) => error.value = err))
        .finally(() => {
          loading.value = false;
          // 加载完成后，无论成功与否都需要清楚延迟定时器
          clearTimeout(loadingTimer);
        })

      let timer = null;
      // 如果指定了超时时长，则开启一个定时器计时
      if (options.timeout) {
        timer = setTimeout(() => {
          // 超时自定义一个错误对象
          const err = new Error(`Async component timed out after ${options.timeout}ms.`)
          error.value = err;
        }, options.timeout);
      }


      // 占位内容
      const placeholder = { type: Text, children: '' };

      return () => {
        // 如果组件加载成功，则渲染该组件
        if (loaded.value) {
          return { type: InnerComp }
        } else if (loading.value && options.loadingComponent) {
          // 如果异步组件正在加载，并且用户指定了 loading 组件，则渲染 loading 组件
          return { type: options.loadingComponent }
        } else if (error.value && options.errorCompoonent) {
          // 如果加载超时 并且用户指定 error 组件，则渲染该组件
          return { type: options.errorCompoonent, props: { error: error.value } };
        }
        // 否则渲染一个占位内容
        return placeholder
      }
    }
  }
}
