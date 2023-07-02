(function () {
    var logger = document.createElement('div');
    logger.style.color = '#333';
    logger.style.width = '50%';
    logger.style.display = 'inline-black';
    logger.style.right = 0;
    logger.style.top = 0;
    logger.style.position = 'absolute';
    logger.style.background = '#ccc';
    logger.style.padding = '0 0 0 20px';
    console.log = function (message) {
      if (typeof message == 'object') {
        logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(message) : message) + '<br />';
      } else {
        logger.innerHTML += message + '<br />';
      }
    }
    document.body.append(logger);
  })();