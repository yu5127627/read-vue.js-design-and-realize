// 定义一个任务队列
const queue = new Set();
// 一个标志代表是否制作正在刷新队列
let isFlushing = false;
// 使用 Promise.resolve() 创建一个 promise 实例，我们用它将一个任务添加到微任务队列
const p = Promise.resolve();

// 调度器的主要函数 用来将一个任务添加到缓冲队列中，并开始刷新队列
function queueJob(job) {
  // 添加任务到缓冲队列中
  queue.add(job);
  // 如果队列还没有开始刷新队列，则刷新
  if (!isFlushing) {
    // 将标志设置为 true 避免重复刷新
    isFlushing = true;
    // 在微任务队列中刷新缓冲队列
    p.then(() => {
      try {
        // 执行任务队列中的任务
        queue.forEach(job => job());
      } finally {
        // 结束后重置 isFlushing
        isFlushing = false
        queue.clear = 0;
      };
    })

  }
}

const nextFrame = (fn) => {
  setTimeout(fn, 0)
}

// 打印 ast 中节点的信息
function dump(node, indent = 0) {
  const type = node.type;
  const desc = node.type === 'Root' ? '' : node.type === 'Element' ? node.tag : node.content;
  console.log(`${'-'.repeat(indent)}${type}: ${desc}`);
  if (node.children) {
    node.children.forEach(n => dump(n, indent + 2));
  }
}