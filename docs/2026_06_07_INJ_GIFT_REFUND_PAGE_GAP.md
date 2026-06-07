# inj-gift 过期红包退款：缺少专门管理页（问题记录）

> 记录日期：2026-06-07
> 相关项目：`inj-gift`（红包 dApp，EVM 模式，testnet 合约 `0xfF2750Ac6f03d4fD4AA19D49a17DC4459cf2d6Ed`）
> 关联：本红包接入 inj-pass 嵌入钱包，过期退款交易会走 `@injpass/cli` 的 tx 弹窗链路（SDK 发包说明见 `inj-pass-frontend/docs/2026_06_07_SDK_PUBLISH.md`）。

---

## 一句话结论

红包过期后**不会自动退款**；剩余金额需由**创建者本人手动**发起 `refund()` 取回。
而 inj-gift **没有一个"专门处理过期退款"的页面**——只有一个半成品的「我的红包」列表页（`/packet`），真正的退款按钮散在每个红包的详情页里，且整条找回路径**强依赖浏览器 localStorage**。

---

## 1. 过期红包的链上行为（先厘清）

| 事项 | 行为 |
|---|---|
| 过期是否自动退款 | ❌ 否。过期本身不触发任何转账 |
| 谁能退款 | 仅**创建者**（`address === creator`） |
| 何时能退 | 仅**过期之后**（`now > expiration`） |
| 退多少 | 只退**未被领取的剩余** = `totalAmount − claimedAmount` |
| 已被领走的份额 | **不退、不追回**（已归领取者） |
| 触发方式 | 创建者**手动**点"过期退款"，发一笔交易（需 gas） |
| 退款后状态 | 剩余归零，前端标为 `refunded` |

证据（代码位置）：
- 过期判定：`src/features/redpacket/domain/types.ts:43-50`（`now > expires_at → expired`）
- 领取在过期后被拒：`src/app/claim/[id]/page.tsx:96`；底层合约 revert `packet-expired`（`src/features/redpacket/domain/errors.ts:9`）
- 退款门槛 `canRefund`：`src/app/packet/[id]/page.tsx:166-172`
  ```
  canRefund = derivedStatus === "expired"   // 必须已过期
            && isCreator                    // 必须是创建者本人
            && remainingAmount > 0n         // 必须还有未领取余额
  ```
- 剩余金额计算：`src/app/packet/[id]/page.tsx:135-139`
- 退款按钮「过期退款」：`src/app/packet/[id]/page.tsx:373`
- 退款合约调用：`src/stacks/evm/contracts/gift.ts:152-166`（`contract.refund(id)`）

---

## 2. 现状：没有专门退款页，`/packet` 只是"半个"

inj-gift 的全部页面路由：`/`、`/create`、`/claim`、`/claim/[id]`、`/packet`、`/packet/[id]`、`/debug`。
其中最接近"管理"的是 `/packet`（标题「我的红包」，`src/app/packet/page.tsx:108`）。

| `/packet` 能做的 | `/packet` **不能**做的（退款缺口） |
|---|---|
| 列出创建过的红包（来自 localStorage） | ❌ **不查链**——看不出哪条已过期、哪条还有钱可退，无"可退款"标记 |
| 每条有：复制分享链接 / 查看 / 移除 | ❌ 列表里**没有退款按钮**，只能"查看"进详情页才看得到 |
| 首页 `/` 也读同一份列表展示（`src/app/page.tsx:102`） | ❌ 没有"你有 N 个过期红包共 X INJ 待退款"的汇总提醒 |

**退款唯一入口**仍是详情页 `/packet/[id]` 的「过期退款」按钮；`/packet` 只是个跳转壳。

---

## 3. 两个隐患

1. **数据只在 localStorage**
   列表读写 `localStorage["injgift.myPackets"]`：
   - 创建时写入：`src/app/create/page.tsx:37`
   - 列表/首页读取：`src/app/packet/page.tsx:22-30`、`src/app/page.tsx:102`

   换浏览器 / 换设备 / 清缓存 / 点了"清空"或"移除"，红包就**从 UI 消失**。

2. **合约没有"按创建者枚举红包"的接口**
   找回必须知道 `packetId`。本地记录一丢——**钱还在链上、仍可退**，但 UI 给不了你重新找到它的路径。

> 净结论：当前「能不能退款」实际上**取决于这台浏览器还留着那条本地记录**。这对"过期退款"是一个真实的资金体验坑（用户可能永久漏退）。

---

## 4. 建议改造（保留 `/packet`，不新增路由、不改整体风格）

分三档，按需推进：

**A. 加链上状态 + 可退款标记（最小）**
- 对 `myPackets` 每条调 `getPacket`（`src/stacks/evm/contracts/gift.ts:24`），显示 `active / expired / claimed_out / 可退款` 徽章与剩余金额。
- 退款仍走详情页，先让用户一眼看清哪条能退。

**B. 列表内直接退款（推荐）**
- 在 A 基础上，把「过期退款」放进列表行：过期的那条就地退款（复用 `useRefundRedPacket` + inj-pass tx 弹窗）。
- 顶部加「N 个过期红包待退款，共 X INJ」汇总提醒（首页也可挂同款 banner）。

**C. 抗丢失（可选增强）**
- 在 B 基础上，加 `packetId` 列表的导出/导入，缓解 localStorage 丢失导致找不回红包的问题。

---

## 5. 相关文件清单

| 用途 | 文件:行 |
|---|---|
| 「我的红包」列表页 | `src/app/packet/page.tsx` |
| 红包详情 + 退款按钮 | `src/app/packet/[id]/page.tsx:135-178, 366-373` |
| 退款 hook | `src/features/redpacket/hooks/useRefundRedPacket.ts` |
| EVM 合约封装（getPacket/refund） | `src/stacks/evm/contracts/gift.ts:24-60, 152-166` |
| 状态推导（active/expired/claimed_out） | `src/features/redpacket/domain/types.ts:43-70` |
| 错误映射（packet-expired 等） | `src/features/redpacket/domain/errors.ts` |
| 创建时写 localStorage | `src/app/create/page.tsx:37` |
| 合约 ABI | `src/lib/abi/InjGift.json` |

---

> 状态：**仅记录，未改代码**（用户 2026-06-07 选择"先不做，只是问问"）。
> 后续要做退款管理页时，从第 4 节 A → B → C 推进即可。
