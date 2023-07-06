### linux 磁盘异常

*错误信息：run fsck manually*

``` shell
# 查找 root 所在分区  /dev/sda3
mount |grep "on//"

# fsck 修复
fsck -y /dev/sda3

# fsck 修复 boot 分区
fack -y /dev/sda1

# 重启
reboot
``````
