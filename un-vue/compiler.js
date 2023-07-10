// 定义状态机的状态
const State = {
  initial: 1, // 初始状态
  tagOpen: 2, // 标签开始状态
  tagName: 3, // 标签名称状态
  text: 4, // 文本状态
  tagEnd: 5, // 结束标签状态
  tagEndName: 6, /// 结束标签名称状态
};

// 辅助函数 用于判断是否是字母
function isAlpha(char) {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

// 接收模板字符串作为参数，并将模板切割为 token 返回
function tokenize(str) {
  // 状态机的当前状态 初始状态
  let currentState = State.initial;
  const chars = []; // 用于缓存字符
  const tokens = []; // 生成的 token 会储存到 tokens 数组中，并作为函数的返回值返回
  // 使用 while 循环开启自动机，只要模板字符串没有被消费尽，自动机就会一直运行
  while (str) {
    const char = str[0]; // 查看第一个字符
    // console.log('char', char);
    // console.log('chars', chars);
    // console.log('tokens', tokens);
    // 匹配当前状态
    switch (currentState) {
      // 状态机当前处于初始状态
      case State.initial:
        if (char === "<") {
          // 1.状态机切换到标签开始状态
          currentState = State.tagOpen;
          // 2.消费字符 <
          str = str.slice(1);
        } else if (isAlpha(char)) {
          // 1.遇到字母，切换到文本状态
          currentState = State.text;
          // 2.将当前字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        }
        break;
      // 状态机当前处于标签开始状态
      case State.tagOpen:
        if (isAlpha(char)) {
          // 1.遇到字母，切换到标签名称状态
          currentState = State.tagName;
          // 2.将当前字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        } else if (char === "/") {
          // 1.遇到字符 /，切换到结束标签状态
          currentState = State.tagEnd;
          // 2.消费字符 /
          str = str.slice(1);
        }
        break;
      // 状态机当前处于标签名称状态
      case State.tagName:
        if (isAlpha(char)) {
          // 1.遇到字母，由于当前处于标签名称状态，所以不需要切换状态，但需要将当前字符缓存到 chars 数组
          chars.push(char);
          // 2.消费当前字符
          str = str.slice(1);
        } else if (char === ">") {
          // 1.遇到字符 >，切换到初始状态
          currentState = State.initial;
          // 2.同时创建一个标签 token,并添加到 tokens 数组中
          // 注意，此时 chars 数组中缓存的字符就是标签名称
          tokens.push({
            type: "tag",
            name: chars.join(""),
          });
          // 3.chars 数组的内容已经被消费，清空
          chars.length = 0;
          // 4.同时消费当前字符 >
          str = str.slice(1);
        }
        break;
      // 状态机当前处于文本状态
      case State.text:
        if (isAlpha(char)) {
          // 1.遇到字母，保持状态不变，但应该将当前字符缓存到 chars 数组
          chars.push(char);
          // 2.消费当前字符
          str = str.slice(1);
        } else if (char === "<") {
          // 1.遇到字符 < ，切换到标签开始状态
          currentState = State.tagOpen;
          // 2.从文本状态  --> 标签开始状态，此时应该创建文本 token,并添加到 tokens 数组
          // 注意，此时 chars 数组中的字符就是文本内容
          tokens.push({
            type: "text",
            content: chars.join(""),
          });
          // 3.chars 数组的内容已经被消费，清空它
          chars.length = 0;
          // 4.消费当前字符
          str = str.slice(1);
        }
        break;
      // 状态机当前处于标签结束状态
      case State.tagEnd:
        if (isAlpha(char)) {
          // 1.遇到字符，切换到结束标签名称状态
          currentState = State.tagEndName;
          // 2.将当前字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        }
        break;
      // 状态机当前处于结束标签名称状态
      case State.tagEndName:
        if (isAlpha(char)) {
          // 1,遇到字母，不需要切换状态，但需要将当前字符缓存到 chars 数组
          chars.push(char);
          // 2.消费当前字符
          str = str.slice(1);
        } else if (char === ">") {
          // 1.遇到字符 >，切换到初始状态
          currentState = State.initial;
          // 2.从结束标签名称状态 --> 初始状态，应该保存结束标签名称 token
          // 注意，此时 chars 数组中缓存的内容就是标签名称
          tokens.push({
            type: "tagEnd",
            name: chars.join(""),
          });
          // 3.chars 数组的内容已经被消费，清空
          chars.length = 0;
          // 4.消费当前字符
          str = str.slice(1);
        }
        break;
    }
  }
  return tokens;
}

// 构造 AST
// 接收模板作为参数
function parse(str) {
  // 首先对模板进行标记化，得到 tokens
  const tokens = tokenize(str);
  // 创建 root 根节点
  const root = {
    type: "Root",
    children: [],
  };
  // 创建栈，起初只有 root 根节点
  const elementStack = [root];
  // 循环扫描 tokens, 直到所有 token 都被扫描完毕为止
  while (tokens.length) {
    // 获取当前栈顶节点作为父节点 parent
    const parent = elementStack[elementStack.length - 1];
    // 当前扫描的 token
    const t = tokens[0];
    switch (t.type) {
      case "tag":
        //  如果当前 token 是开始标签，则创建 element 类型的 ast 节点
        const elementNode = {
          type: "Element",
          tag: t.name,
          children: [],
        };
        // 添加到父节点的 children 中
        parent.children.push(elementNode);
        // 将当前节点压入栈
        elementStack.push(elementNode);
        break;
      case "text":
        // 如果当前 token 是文本，则创建 text 类型的 ast 节点
        const textNode = {
          type: "Text",
          content: t.content,
        };
        // 将其添加到父节点的 children 中
        parent.children.push(textNode);
        break;
      case "tagEnd":
        // 遇到结束标签，将栈顶节点弹出
        elementStack.pop();
        break;
    }
    // 消费已经扫描过的 token
    tokens.shift();
  }
  return root;
}

// 转换 root 根节点
function transformRoot(node) {
  return () => {
    if (node.type !== "Root") {
      return;
    }
    // node 是根节点，根节点的第一个节点就是模板的根节点
    // 暂时忽略多个根节点
    const vnodeJSAST = node.children[0].jsNode;
    // 创建 render 函数的声明语句，将 vnodeJSAST 作为 render 函数体的返回语句
    node.jsNode = {
      type: "FunctionDecl",
      id: {
        type: "Identifier",
        name: "render",
      },
      params: [],
      body: [
        {
          type: "ReturnStatement",
          return: vnodeJSAST,
        },
      ],
    };
  };
}

// 转换标签节点
function transformElement(node) {
  //  将转换代码编写在退出阶段的回调函数中
  // 这样可以保证该标签节点的字节点全部被处理完毕
  return () => {
    // 如果被转换的节点不是元素节点 则什么都不做
    if (node.type !== "Element") {
      return;
    }
    // 1.创建 h 函数调用语句
    // h 函数调用的第一个参数是标签名称，因此我们以 node.tag 来创建一个字符串字面量节点作为参数
    const callExp = createCallExpression("h", [createStringLiteral(node.tag)]);
    // 2.处理 h 函数调用的参数
    node.children.length === 1
      ? // 如果当前标签节点只有一个子节点，则直接使用子节点的 jsNode 作为参数
        callExp.arguments.push(node.children[0].jsNode)
      : // 如果当前标签节点有多个子节点 则创建一个 ArrayExpression 节点作为参数
        callExp.arguments.push(
          // 数组的每个元素都是子节点的 jsNode
          createArrayExpression(node.children.map((c) => c.jsNode))
        );
  };
}

// 转换文本节点
function transformText(node) {
  if (node.type !== "Text") {
    return;
  }
  // 文本节点对应 js ast 节点其实就是一个字符串字面量
  node.jsNode = createStringLiteral(node.content);
}

// ast 节点深度访问
function traverseNode(ast, context) {
  // 设置当前转换的节点信息
  context.currentNode = ast;

  // 1.增加推出阶段的回调函数数组
  const exitFns = [];
  // context.nodeTransforms 是一个数组，其中每一个元素都是一个函数
  const transforms = context.nodeTransforms;
  for (let i = 0; i < transforms.length; i++) {
    // 2.转换函数可以返回一个函数，该函数即作为退出阶段的回调函数
    const onExit = transforms[i](context.currentNode, context);
    if (onExit) {
      // 将退出阶段的回调函数添加到 exitFns 数组中
      exitFns.push(onExit);
    }

    // 检查当前节点是否被移除，移除直接返回
    if (!context.currentNode) return;
  }

  // 如果有子节点，则递归的调用 traverseNode 函数进行遍历
  const children = context.currentNode.children;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      // 递归地调用 traverseNode 转换子节点之前，将当前节点设置为父节点
      context.parent = context.currentNode;
      context.childIndex = i; // 设置位置索引
      // 递归的调用时，将 context 透传
      traverseNode(children[i], context);
    }
  }
  // 在节点处理的最后阶段执行缓存到 exitFns 中的回调函数
  let i = exitFns.length;
  // 注意，此处反续执行
  while (i--) {
    exitFns[i]();
  }
}

function transform(ast) {
  // 上下文对象
  const context = {
    currentNode: null, // 当前正在转换的节点
    childIndex: 0, // 当前节点在父节点的 children 中的位置索引
    parent: null, // 当前转换节点的父节点
    // 用于替换节点的函数 接受新节点作为参数
    replaceNode(node) {
      // 为了替换节点，我们需要修改 AST
      // 找到当前节点在父节点的 children 中的位置，直接使用新节点替换即可
      context.parent.children[context.childIndex] = node;
      // 由于当前节点已经被新节点替换，所以需要更新节点
      context.currentNode = node;
    },
    // 用于删除当前节点
    removeNode() {
      if (context.parent) {
        // 根据当前节点的索引删除当前节点
        context.parent.children.splice(context.childIndex, 1);
        // 当前节点置空
        context.currentNode = null;
      }
    },
    nodeTransforms: [
      transformRoot,
      // 注册的转换函数
      transformElement,
      transformText,
    ],
  };
  traverseNode(ast, context);
  // dump(ast);
}
