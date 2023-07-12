// 定义状态机的状态
const State = {
    initial: 1, // 初始状态
    tagOpen: 2, // 标签开始状态
    tagName: 3, // 标签名称状态
    text: 4, // 文本状态
    tagEnd: 5, // 结束标签状态
    tagEndName: 6, /// 结束标签名称状态
};

// 定义文本模式，作为一个状态表
const TextModes = {
    DATA: 'DATA',
    RCDATA: 'RCDATA',
    RAWTEXT: 'RAWTEXT',
    CDATA: 'CDATA'
}

const namedCharacterReferences = {
    "gt": ">",
    "gt;": ">",
    "lt": "<",
    "lt;": "<",
    "ltcc;": "⪦",
}

const CCR_REPLACEMENTS = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178
}

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
            body: [{
                type: "ReturnStatement",
                return: vnodeJSAST,
            }, ],
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
        node.children.length === 1 ? // 如果当前标签节点只有一个子节点，则直接使用子节点的 jsNode 作为参数
            callExp.arguments.push(node.children[0].jsNode) : // 如果当前标签节点有多个子节点 则创建一个 ArrayExpression 节点作为参数
            callExp.arguments.push(
                // 数组的每个元素都是子节点的 jsNode
                createArrayExpression(node.children.map((c) => c.jsNode))
            );
        node.jsNode = callExp
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
            // 注册的转换函数
            transformRoot,
            transformElement,
            transformText,
        ],
    };
    traverseNode(ast, context);
    dump(ast);
}

function isEnd(context, ancestors) {
    // 当模板内容解析完毕后，停止
    if (!context.source) return true
    for (var i = ancestors.length - 1; i >= 0; --i) {
        if (context.source.startsWith(`</#{ancestors[i].tag}`)) {
            return true
        }
    }
    // 获取父级标签节点
    const parent = ancestors[ancestors.length - 1];
    // 如果遇到结束标签，并且该标签与父级标签节点同名，则停止
    if (parent && context.source.startsWith(`</${parent.tag}`)) {
        return true
    }
}


function parseChildren(context, ancestors) {
    // nodes 数组储存子节点，它将作为最终的返回值
    let nodes = [];
    // 从上下文对象中取得当前状态
    const { mode, source } = context;
    // 对字符串进行解析
    while (!isEnd(context, ancestors)) {
        let node;
        // 只有 DATA 模式和 RCDATA 模式才支持插值节点的解析
        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            // 只有 DATA 模式才支持标签节点的解析
            if (mode === TextModes.DATA && source[0] === '<') {
                if (source[1] === '') {
                    if (source.startsWith("<!--")) {
                        // 注释
                        node = parseComment(context);
                    } else if (source.startsWith('<![CDATA[')) {
                        // CDATA
                        node = parseCDATA(context, ancestors);
                    }
                } else if (source[1] === '/') {
                    // 结束标签，这里需要抛出错误
                    console.error('无效的结束标签');
                    continue
                } else if (/[a-z]/i.test(source[1])) {
                    // 标签
                    node = parseElement(context, ancestors);
                }
            } else if (source.startsWith('{{')) {
                // 解析插值
                node = parseInterpolation(context);
            }
        }
        // node 不存在，说明处于其他模式，即非 DATA 模式且非 RCDATA 模式
        // 一切内容都作文本处理
        if (!node) {
            // 解析文本节点
            node = parseText(context)
        }
        // 将节点添加到 nodes 数组中
        nodes.push(node);
    }
    return nodes
}

// 处理开始标签和结束标签
function parseTag(context, type = 'start') {
    const { advanceBy, advanceSpaces } = context;
    // 处理开始标签和结束标签的正则表达式不同
    const match = type === 'start' ?
        /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source) :
        /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);
    // 匹配成功后，正则表达式的第一个捕获组的值就是标签名称
    const tag = match[1];
    // 消费正则表达式匹配的全部内容，例如 ‘<div’ 这段内容
    advanceBy(match[0].length);
    // 消费标签中无用的空白字符
    advanceSpaces();

    // 属性与指令的解析，得到 props 数组
    // props 数组是由指令节点与属性节点共同组成的数组
    const props = parseAttributes(context);

    // 在消费匹配内容后，如果字符以 '/>' 开头，则说明这是一个自闭合标签
    const isSelfClosing = context.source.startsWith('/>');
    // 如果是自闭合标签，则消费 '/>'，否则消费 ‘>’
    advanceBy(isSelfClosing ? 2 : 1);
    // 返回标签节点
    return {
        type: 'Element',
        tag, // 标签名称
        props, // 标签的属性
        children: [], // 子节点
        isSelfClosing // 是否自闭合
    }
}

function parseElement(context, ancestors) {
    // 调用 parseTag 函数解析开始标签
    const element = parseTag(context);
    if (element.isSelfClosing) return element
    // 切换到正确的文本模式
    if (element.tag === 'texttarea' || element.tag === 'title') {
        // 如果是 texttarea title 则切换到 RCDATA 模式
        context.mode = TextModes.RCDATA;
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT;
    } else {
        context.mode = TextModes.DATA;
    }

    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();

    if (context.source.startsWith(`</${element.tag}`)) {
        // 再次调用 parseTag 函数解析结束标签，传递了第二个参数 ‘end’
        parseTag(context, 'end');
    } else {
        console.error(`${element.tag} 标签缺少闭合标签`)
    }
    return element
}

function parseAttributes(context) {
    const props = [];
    const { advanceBy, advanceSpaces } = context;
    while (!context.source.startsWith('>') && !context.source.startsWith('/>')) {
        // 该正则用于匹配属性名称
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
        const name = match[0]; // 得到属性名称

        advanceBy(name.length); // 消费属性名称
        advanceSpaces(); // 消费属性名称与等于号之间的空白字符
        advanceBy(1); // 消费等于号
        advanceSpaces(); // 消费等于号与属性值之间的空白字符

        let value = ''; // 属性值

        const quote = context.source[0]; // 获取当前模板内容的第一个字符
        // 判断属性值是否被引号引用
        const isQuoted = quote === '"' || quote === "'";

        if (isQuoted) {
            advanceBy(1); // 属性值被引号引用，消费引用
            // 获取下一个引号的索引
            const endQuoteIndex = context.source.indexOf(quote);
            if (endQuoteIndex > -1) {
                // 获取下一个引号之前的内容作为属性值
                value = context.source.slice(0, endQuoteIndex);
                advanceBy(value.length); // 消费属性值
                advanceBy(1); // 消费引号
            } else {
                console.error('缺少引号')
            }
        } else {
            // 到此处 说明属性值并没有被引号引用
            // 下一个空白字符之前的内容全部作为属性值
            const match = /^[^\t\r\n\f >]+/.exec(context.source);
            value = match[0]; // 获取属性值
            advanceBy(value.length); // 消费属性值
        }
        advanceSpaces(); // 消费属性值后面的空白字符

        // 使用属性名称 + 属性值创建一个属性节点 添加到 props 数组中
        props.push({
            type: 'Attribute',
            name,
            value
        })
    }
    return props
}

function parseText(context) {
    // endIndex 为文本内容的结尾索引，默认将整个模板剩余内容都作为文本内容
    let endIndex = context.source.length;
    // 寻找字符 < 的位置索引
    const ltIndex = context.source.indexOf('<');
    // 寻找定界符 {{ 的位置索引
    const delimiterIndex = context.source.indexOf('{{');

    // 取 ltIndex 和当前 endIndex 中较小的一个作为新的结尾索引
    if (ltIndex > -1 && ltIndex < endIndex) {
        endIndex = ltIndex;
    }

    // 取 delimiterIndex 和当前 endIndex 中较小的一个作为新的结尾索引
    if (delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex
    }

    // 此时 endIndex 是最终的文本内容的结尾索引，调用 slice 函数截取文本内容
    const content = context.source.slice(0, endIndex);
    // 消耗文本内容
    context.advanceBy(content.length);

    // 返回文本节点
    return {
        type: 'Text',
        content
    }
}


// rawText: 要被解码的文本内容
// asAttr：一个布尔值，代表文本内容是否作为属性值
function decodeHtml(rawText, asAttr = false) {
    let offset = 0;
    const end = rawText.length;
    let decodeText = ''; // 经过解码后的文本将作为返回值被返回
    let maxCRNameLength = 0; // 引用表中实体名称的最大长度

    // 用于消费指定长度的文本
    function advance(length) {
        offset += length;
        rawText = rawText.slice(length);
    }

    // 消费字符串，直到处理完毕为止
    while (offset < end) {
        // 用于匹配字符引用的开始部分，如果匹配成功，那么 head[0] 的值有三种可能
        // 1.head[0] === '&': 说明该字符引用是命名字符引用
        // 1.head[0] === '&#': 说明该字符引用是用十进制表示的数字字符引用
        // 1.head[0] === '&#X': 说明该字符引用是用十六进制表示的数字字符引用
        const head = /&(?:#x?)?/i.exec(rawText);
        // 没有匹配，说明已经没有需要解码的内容
        if (!head) {
            // 计算剩余内容的长度
            const remaining = end - offset;
            // 将剩余内容添加到 decodeText
            decodeText += rawText.slice(0, remaining);
            // 消费剩余内容
            advance(remaining);
            break;
        }

        // head.index 为匹配的字符 & 在 rawText 中的位置索引
        // 截取字符 & 之前的内容加到 decodeText 上
        decodeText += rawText.slice(0, head.index);
        advance(head.index); // 消费字符 & 之前的内容

        // 如果满足条件，则说明是命名字符引用，否则为数字字符引用
        if (head[0] === '&') {
            let name = '';
            let value;
            // 字符 & 的下一个字符必须是 ascii 字母或数字
            if (/[0-9a-z]/i.test(rawText[1])) {
                // 根据引用表计算实体名称的最大长度
                if (!maxCRNameLength) {
                    maxCRNameLength = Object.keys(namedCharacterReferences).reduce((max, name) => Math.max(max, name.length), 0)
                }
                // 从最大长度开始对文本进行截取，并试图去引用表中找到对应的项
                for (let length = maxCRNameLength; !value && length > 0; --length) {
                    // 截取字符 & 到最大长度之间的字符作为实体名称
                    name = rawText.substr(1, length);
                    // 使用实体名称去索引表中查找对应项的值
                    value = (namedCharacterReferences)[name];
                }

                // 如果找到了对应项的值，说明解码成功
                if (value) {
                    // 检查实体名称的最后一个匹配字符是否是分号
                    const semi = name.endsWith(';');

                    // 如果解码的文本作为属性值，最后一个匹配的字符不是分号
                    // 并且最后一个匹配字符的下一个字符是等于号（=）、ascii 字母或数字，由于历史原因，将字符 & 和实体名称 name 作为普通文本
                    if (asAttr && !semi && /[=a-z0-9]/i.test(rawText[name.length + 1] || '')) {
                        decodeText += '&' + name;
                        advance(1 + name.length)
                    } else {
                        // 其他情况下，正常使用解码后的内容拼接到 decodeText
                        decodeText += value;
                        advance(1 + name.length);
                    }
                } else {
                    // 如果没有找到对应的值 说明解码失败
                    decodeText += '&';
                    advance(1);
                }

            } else {
                // 如果字符 & 的下一个字符不是 ascii 字母或数字，则将字符 & 作为普通文本
                decodeText += '&';
                advance(1);
            }
        } else {
            // 判断是十进制表示还是十六进制表示
            const hex = head[0] = '&#x';
            // 根据不同进制表示法 选用不同的正则
            const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#([0-9]+);?/;
            // 最终，body[1] 的值就是 unicode 码点
            const body = pattern.exec(rawText);

            // 匹配成功，则进行解码
            if (body) {
                // 根据对应的进制，将码点字符串转换为数字
                let cp = Number.parseInt(body[1], hex ? 16 : 10);
                if (cp === 0) { // 码点的合法性检查
                    // 如果码点为 0x00,替换为 0xfffd
                    cp = 0xfffd;
                } else if (cp > 0x10ffff) {
                    // 如果码点值超过 unicode 的最大值，替换为 oxfffd
                    cp = 0xfffd;
                } else if (cp >= 0xd800 && cp <= 0xdfff) {
                    // 如果码点值处于 surrogate pair 范围内，替换为 0xfffd
                    cp = 0xfffd;
                } else if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe) {
                    // 如果码点值处于 noncharacter 范围内，则什么都不做，交给平台处理
                } else if (
                    // 控制字符集的范围是 [0x01, 0x1f] 加上 [0x7f, 0x9f]
                    // 去掉 asicc 空白符 0x09(TAB)、0x0A(LF)、0x0C(FF)
                    // 0x0D(CR) 虽然也是 asicc 空白符，但需要包含
                    (cp >= 0x01 && cp <= 0x08) || cp === 0x0b ||
                    (cp >= 0x0d && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f)
                ) {
                    // 在自定义列表中查找替换码点，如果找不到，则使用原码点
                    cp = CCR_REPLACEMENTS[cp] || cp;
                }
                // 解码后追加到 decodedText 上
                decodeText += String.fromCodePoint(cp);
                // 消费整个数字字符引用的内容
                advance(body[0].length);
            } else {
                // 如果没有匹配，则不进行解码操作，只是把 head[0] 追加到 decodeText 上并消费
                decodeText += head[0];
                advance(head[0].length)
            }

        }

    }
    return decodeText
}