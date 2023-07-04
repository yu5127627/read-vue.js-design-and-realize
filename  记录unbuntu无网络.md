```shell
#  打开网络配置文件
sudo vim /etc/NetworkManager/NetworkManager.conf

# 修改 managed=true
managed=True

# 停止 networkmanager 运行
sudo service NetworkManager stop
# 清除缓存
sudo rm /var/lib/NetworkManager/NetworkManager.state
# 重新启动
sudo service NetworkManager start
# 不出意外应该已经解决问题了
```