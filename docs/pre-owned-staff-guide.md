# 二手车上架说明（员工用）

后台地址：`https://admin.uksev.co.uk/`。手机、电脑都能用，手机上用最顺手。

## 1. 打开后台

1. 浏览器打开 `https://admin.uksev.co.uk/`。
2. 第一次会跳到 Cloudflare 的验证页，按页面提示验证（一般是填公司邮箱，再填邮件里的验证码）。只有管理员加进白名单的邮箱才能进。
3. 验证通过后直接进车辆列表，不用再输密码或令牌。

看到 **Session expired · Refresh to sign in again**：点 Refresh，再验证一次邮箱就行。没发布的草稿还留在这台手机上，不会丢。

## 2. 上架一辆车

点右下角 **Add listing**，按顺序填：

| 字段 | 必填 | 怎么填 |
|---|---|---|
| Type | 是 | e-bike 或 e-scooter |
| Brand / Model | 是 | 照车架或电池上的铭牌写，比如 `ENGWE` / `EP-2 Pro` |
| Year | 是 | 车的出厂年份 |
| Mileage | 是 | 码表上的里程，单位**英里**。码表显示公里的话乘以 0.621 |
| Guide price | 是 | 指导售价，英镑，只填数字 |
| Photos | 是，至少 1 张 | 见下面第 3 节 |
| Battery health | 建议填 | 电池健康度 %。读数要来自 App 或诊断仪，读不到就留空，不估 |
| Battery reading source | 填了健康度就要填 | 读数从哪来，比如 `Engwe app`、`Bafang diagnostic` |
| Battery capacity / Charge cycles | 选填 | 电池容量 Wh，充电循环次数 |
| Motor power / Frame size / Wheel size / Range | 选填 | 电机 W、车架尺寸、轮径、官方续航（英里） |
| Grade | 选填 | A 几乎没有使用痕迹；B 有轻微划痕或磨损，不影响使用；C 磨损明显但功能正常 |
| New price | 选填 | 新车原价，前台会划线显示 |
| Inspection | 选填 | 每项选 Pass / Replaced / Note。Replaced 和 Note 要写一句说明 |
| What's included | 选填 | 随车物品，比如原装充电器、钥匙。没有的勾成 not included |
| 描述 | 选填 | 几句话说车况和来历 |

**不要填**车架号、序列号、车牌、前车主姓名或电话。仓库是公开的，填进去谁都能看到，删了也会留在历史记录里。

## 3. 拍照

- 横拍，白天光线，背景干净。
- 顺序：整车侧面（第一张就是封面）、车头、电池、电机、码表读数、所有瑕疵近拍。
- 照片里有车架号或车牌的，先打码再传。
- 最多 20 张。iPhone 的 HEIC 可以直接传，后台会自动压缩、转格式，并去掉定位信息。
- 拖动照片可以调顺序，第一张自动当封面。

## 4. 发布

1. 点底部 **Publish**。有必填项没填，会自动跳到那一项，填好再点。
2. 底部会显示进度：先一张张上传照片，再提交。
3. 显示 **Published** 后，顶部横幅先显示 **Deploying…**，1 到 2 分钟后变成 **Live**，网站上就能看到了。
4. 5 分钟还没变 Live、提示 **Deployment may have failed**：内容已经存进去了，别重复发布，截图发给管理员。

没填完想先放着：直接退出就行，草稿自动存在**这台设备**上。换一台手机看不到这份草稿。

## 5. 改状态、改价、删除

- **预留 / 已售**：在列表里点那辆车的状态，选 Reserved 或 Sold，改完会马上发布。选 Sold 时，系统自动把当天记为卖出日期。
- 已售的车前台不显示价格，只盖「SOLD」章。30 天后自动从列表撤下，详情页链接还能打开。
- Reserved 不会自动变回在售，客人不要了要手动改回 Available。
- **改价或改信息**：点进那辆车，改完再点 Publish。
- **删除**：只在录错或重复的时候删。卖掉的车改成 Sold 就行，不要删。

## 6. 常见提示

| 提示 | 意思 | 怎么办 |
|---|---|---|
| Session expired · Refresh to sign in again | Cloudflare 的验证到期了 | 点 Refresh，重新验证邮箱 |
| Not published，下面有 Reload their version | 你编辑的时候，有同事也改了同一辆车 | 点 Reload their version 看最新内容，或者点 Keep my edits as draft 先把自己的改动存下来，再对一下 |
| 列表里改状态时提示 Not published，按钮是 Cancel | 同事刚改过这辆车 | 点 Cancel，等列表刷新后再改一次状态 |
| 在列表里改状态时弹出提示，按钮是 Close | 登录过期、没网或凭证失效，状态没改成（The status wasn’t changed.） | 点 Close，按上面对应那一行处理后再改一次 |
| 底栏红字，比如 Brand missing | 必填项没填或格式不对 | 按提示补上那一项再点 Publish |
| You’re offline | 手机没网 | 换个信号好的地方再点 Publish，草稿不会丢 |
| Someone published just now | 同事刚好也在发布 | 不用管，后台会自动基于最新版本重试 |
| Publishing credential invalid · Contact your admin. | 后台用来提交的 GitHub 令牌过期了 | 找管理员更换，员工这边没法处理 |
| 顶部琥珀色横幅 Publishing credential expires in 5 days (22 Oct) | 后台令牌 7 天内到期，天数和日期按实际显示 | 转告管理员 |

## 管理员备忘

- 加员工或去掉员工：在 Cloudflare Access 应用的策略里改邮箱白名单。
- 后台的写入凭证由管理员在公司服务器上维护。员工这边看到「Publishing credential invalid」时找管理员即可。
- 每次发布的提交信息末尾带 `Published-by: <邮箱>`，能查到是谁发的。
