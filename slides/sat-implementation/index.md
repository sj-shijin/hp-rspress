---
marp: true
title: 现代 SAT 求解器：传播、搜索策略与内处理
description: 用传播轨迹、活跃度更新和模型恢复的完整例子，理解 CDCL 求解器的实现成本、搜索控制、公式简化与效果评估。
theme: cinderfolio
size: 16:9
sizes: ["16:9", "4:3"]
math: mathjax
lang: zh-CN
paginate: true
transition: fade 300ms
header: '[传播成本](#3) [搜索控制](#9) [公式简化](#14) [效果评估](#20)'
footer: ShiJin · SAT 求解器实现与优化
---

<!-- _class: cover -->
<!-- _paginate: skip -->
<!-- _header: "" -->
<!-- _footer: "" -->

# 现代 SAT 求解器 <small>实现与优化</small>

传播 · 搜索策略 · 内处理

ShiJin · 2026 年 10 月

<!-- 前置知识：单位传播、trail、决策层、1-UIP 与回跳。基础算法见《SAT 求解：从 DPLL 到 CDCL》。本演示聚焦单次 CNF 求解；增量调用与结果验证在第三篇《使用 SAT：从约束建模到可信结果》中串联，完整推导见配套知识笔记。所有带“教学算例”的数字均用于解释机制，不是求解器实验结果。 -->

---

## CDCL 的逻辑步骤与执行成本

```mermaid
flowchart LR
  D[决策] --> P[传播]
  P -->|发生冲突| A[分析与学习]
  A --> B[回跳]
  B --> P
  P -->|无冲突且未完成| D
```

1. **[传播成本](#3)**：怎样减少不必要的子句访问？
2. **[搜索控制](#9)**：决定谁、搜索多久、保留哪些学习子句？
3. **[公式简化](#14)**：怎样缩小问题并恢复原问题的模型？
4. **[效果评估](#20)**：局部节省是否变成整体加速？

前篇：<a href="/slides/sat-cdcl/index.html" target="_top">SAT 求解：从 DPLL 到 CDCL</a>。

<!-- 图中省略返回 SAT/UNSAT 的出口，完整循环见基础演示。传播、分析、维护和变换都消耗时间；启发式不替代推理正确性的论证。来源：[1] §4；[3] §4.3；[4] §9.1。 -->

---

<!-- header: '**[传播成本](#3)** [搜索控制](#9) [公式简化](#14) [效果评估](#20)' -->
<!-- _class: transition -->

01

## 传播成本

把“每次赋值检查全部子句”变为按事件访问。

---

<!-- _class: compact -->

## trail 同时记录赋值与待处理事件

$$
\begin{aligned}
C_1&=(\neg a\lor b),& C_2&=(\neg b\lor c\lor d),\\
C_3&=(\neg b\lor\neg c),& C_4&=(\neg d\lor\neg b).
\end{aligned}
$$

决定 $a=1$，随后由 $C_1$ 将 $b$ 置真并入队：

$$
\operatorname{trail}=[\underbrace{a}_{\text{已处理}},\underbrace{b}_{\text{待处理}}],
\qquad h=1.
$$

- 入队立即设置真值、决策层和原因，再追加到 trail。
- $h$ 从 $0$ 开始，指向下一个待处理事件。
- 处理 $p$ 时访问 $W[\neg p]$：监视了刚变假文字的子句。

**无冲突且 $h=|\operatorname{trail}|$，才达到传播不动点。**

<!-- 本例所有初始变量均未赋值，先建立监视，再在第 1 层决定 a=1。W[l] 表示监视文字 l 的条目列表；MiniSat 源码把列表挂在互补文字下，访问 watches[p]，只是索引约定不同。这里 h=1 时 b 的事件未处理，但 b=1 已可被任意子句查询。来源：[1] §§3、4.3；[2] uncheckedEnqueue、propagate。 -->

---

## 双监视文字的四种情况

设监视文字 $w$ 刚变假，另一个监视文字为 $q$。

| 当前状态 | 要做的工作 |
| :--- | :--- |
| $q$ 为真 | 子句已满足，保留监视 |
| $q$ 非真，另有非假文字 $r$ | 把监视从 $w$ 移到 $r$ |
| 找不到 $r$，$q$ 未赋值 | 将 $q$ 置真并入队，记录原因 |
| 找不到 $r$，$q$ 也为假 | 返回冲突子句 |

“非假”包括**真或未赋值**；找不到替代项不一定意味着传播。\
单位子句单独入队；空子句和相反的单位要求在初始化时报告冲突。

<!-- 四行按顺序判定。长度至少为 2 的子句使用两个不同监视位置，初始化消除重复文字和重言式。MoveWatch 必须同时维护子句位置与监视列表。来源：[1] §4.3；[2] attachClause、propagate。 -->

---

<!-- _class: compact -->

## 一次传播中的移动、入队与冲突

$C_2=(\neg b\lor c\lor d)$ 最初监视 $\neg b,c$。

| 处理事件 | 按此顺序检查子句 | 处理后的状态 |
| :--- | :--- | :--- |
| $a$ | $C_1$ 传播 $b$ | trail 为 $[a,b]$，$h=1$ |
| $b$ | $C_2$ 将 $\neg b$ 的监视移到 $d$ | $C_2$ 监视 $d,c$ |
| $b$（续） | $C_3$ 传播 $\neg c$，$C_4$ 传播 $\neg d$ | $[a,b,\neg c,\neg d]$，$h=2$ |
| $\neg c$ | $C_2$ 的 $c,d,\neg b$ 都为假 | 返回 $C_2$，此刻 $h=3$ |

$$
\operatorname{trail}=[a,b,\neg c,\underbrace{\neg d}_{\text{事件尚未处理}}]
$$

**$d=0$ 已生效，所以检查 $C_2$ 时已经能发现冲突。**

<!-- 这是合法的监视列表访问顺序，实际顺序可能不同。处理 b 时先移动 C2 的监视，再由 C3、C4 入队两个文字；处理 ¬c 时访问 W[c]。此处 h 是教学循环提前返回时的指针，不能直接视为 MiniSat 冲突出口的最终 qhead：该源码会把 qhead 设到 trail 末尾并保留尚未处理的监视条目。冲突后进入分析与回跳，不继续沿本分支决策。来源：[2] propagate；例子由四个子句直接推演。 -->

---

## 处理一个变假的监视文字

```pseudocode
\begin{algorithm}
\caption{Process a False Watch}
\begin{algorithmic}
\FUNCTION{ProcessWatch}{$C,w$}
    \STATE $q\gets$ \CALL{OtherWatch}{$C,w$}
    \IF{$\operatorname{value}(q)=1$}
        \RETURN $\mathrm{None}$
    \ENDIF
    \STATE $r\gets$ \CALL{FindNonFalse}{$C\setminus\{w,q\}$}
    \IF{$r\ne\mathrm{None}$}
        \STATE \CALL{MoveWatch}{$C,w,r$}
    \ELIF{$\operatorname{value}(q)=0$}
        \RETURN $C$
    \ELSE
        \STATE \CALL{Enqueue}{$q,C$}
    \ENDIF
    \RETURN $\mathrm{None}$
\ENDFUNCTION
\end{algorithmic}
\end{algorithm}
```

教学伪代码：省略容器管理；返回子句表示冲突，None 表示继续。

<!-- 前提：C 长度至少为 2，w 是变假的一个监视文字。value 考虑文字正负号，返回 1、0 或未赋值；FindNonFalse 返回候选文字或 None。走到 Enqueue 时 q 必为未赋值。该过程依赖共享赋值、trail 和监视列表，不能独立运行。外层遍历移动中的监视列表时不能漏项；冲突提前返回也要保留未访问条目。来源：[1] §4.3；[2] propagate。 -->

---

<!-- _class: compact -->

## 阻塞文字与回溯中的状态维护

<div class="cf-cols">
<div class="cf-col">

### 先查缓存，再读子句

监视条目缓存子句中的一个文字 $b_C$。

- $b_C$ 为真：子句已满足，跳过对子句存储的访问。
- $b_C$ 非真：继续检查子句，不能直接判冲突。
- 缓存不必总是另一个监视文字，但必须属于该子句。

</div>
<div class="cf-col">

### 回跳保留监视位置

标准回跳截去 trail 的高层后缀。

- 撤销相应赋值和原因；$h$ 回到保留前缀的末尾。
- 加入学习子句并入队断言文字，重新传播。
- 不恢复历史监视位置；撤销赋值不产生“变假”事件。

</div>
</div>

子句被改写或删除时，监视条目、缓存和原因引用必须同步维护。

<!-- 标准回跳的前提是每次新决策前传播到不动点，因此保留的低层前缀已完成传播。新学习子句须正确建立监视：常用断言文字和其余文字中决策层最高的一项。阻塞文字的字母 b_C 与前面变量 b 无关，不把它当成算法推理中的“阻塞子句”。来源：[1] §§3、4.3；[2] cancelUntil、attachClause、propagate。 -->

---

<!-- header: '[传播成本](#3) **[搜索控制](#9)** [公式简化](#14) [效果评估](#20)' -->
<!-- _class: transition -->

02

## 搜索控制

分支、相位、重启与子句管理共同改变搜索路线。

---

<!-- _class: compact -->

## 活跃度选择变量，相位决定取值

教学模型：$A_t(v)=\rho A_{t-1}(v)+\mathbf1[v\in S_t]$。

所有变量初值为 $0$，取 $\rho=1/2$：

| 冲突 $t$ | 本次加分集合 $S_t$ | $A_t(a)$ | $A_t(b)$ | $A_t(c)$ |
| :--- | :--- | ---: | ---: | ---: |
| 1 | $\{a,b\}$ | $1$ | $1$ | $0$ |
| 2 | $\{b,c\}$ | $1/2$ | $3/2$ | $1$ |
| 3 | $\{c\}$ | $1/4$ | $3/4$ | $3/2$ |
| 4 | $\{a\}$ | $9/8$ | $3/8$ | $3/4$ |

近期参与冲突的权重更大；分支只比较**允许决策的未赋值变量**。

若下一步选中 $a$，而保存相位是 $0$，可以决定 $a=0$。

**活跃度不是变量取真的概率。**

<!-- S_t 是假定的加分事件，不是前面四子句算例产生的冲突序列。VSIDS 类策略的加分对象和时机依实现而异，这个递推式只说明指数衰减。相位保存与变量排序是两个选择。来源：[1] §4.6；[3] §§4.3.1.2.3、4.3.1.4。旧稿 HVC_2015_VSIDS 的活跃度、衰减与 EMA 内容可作为延伸：https://github.com/sj-shijin/assets/blob/main/HVC_2015_VSIDS/HVC_2015_VSIDS_marp.md 。 -->

---

<!-- _class: compact -->

## 用增长的加分量代替全体衰减

直接更新 $A_t$ 需要每轮遍历全部变量。改为只给 $S_t$ 中的变量加分：

$$
B_t(v)=B_{t-1}(v)+\rho^{-(t-1)}\mathbf1[v\in S_t],
\qquad A_t(v)=\rho^{t-1}B_t(v).
$$

共同的正比例因子不改变排序。

当 $\rho=1/2$，四轮的加分量为 $1,2,4,8$：

$$
\mathbf B_4=(9,3,6),\qquad \mathbf A_4=\tfrac18\mathbf B_4.
$$

- 只更新本轮涉及的变量，并同步优先队列。
- 分值过大时统一缩放，保留相对次序。

<!-- 这是前页递推式的代数等价实现，初始 B_0=0，第一轮增量为 1。不能只放大部分变量而不维护共同尺度，也不能更新分值后遗漏堆中位置。MiniSat 采用增长的 var_inc、活动度累加及必要的缩放；具体参数和更新对象以实现为准。来源：[1] §4.6。LRB 使用另一类奖励定义，可另读 SAT_2016_LRB 旧稿；本页不声称 VSIDS 与 LRB 存在跨实例的固定优劣关系。 -->

---

<!-- _class: compact -->

## 重启预算与近期学习信号

<div class="cf-cols">
<div class="cf-col">

### 预定冲突预算

Luby 基线，基本预算为 $B$：

$$
B\cdot(1,1,2,1,1,2,4,\ldots)
$$

短尝试之间穿插较长搜索。

预算按冲突次数计，不等于时间。

</div>
<div class="cf-col">

### 比较快、慢 LBD 平均

$f,s$ 分别跟踪近期与较长历史。

简化触发条件：$f>\kappa s$。

教学算例：初值均为 $4$，新 LBD 为 $8$；更新权重为 $1/2,1/8$。

得到 $f=6,s=4.5$；取 $\kappa=1.2$ 时满足条件。

</div>
</div>

普通重启撤销非根层赋值，保留学习子句与所需启发式状态。

<!-- EMA 递推为 f_t=(1-alpha_f)f_(t-1)+alpha_f*g_t，s 同理。右栏是 2019 年论文中的快慢 EMA 思路，不能把它与 2012 年 Glucose 的有限窗口/全局平均实现视为完全相同。参数仅为手算示例；实际还要处理初始化、最小间隔、阻止重启的条件。该信号不证明当前分支无解，任意重启和删除组合也不自动保证终止。来源：[3] §4.3.1.2；[5] §§3、4.1–4.3。 -->

---

<!-- _class: compact -->

## 学习子句的收益与持续成本

$$
\operatorname{LBD}_{\tau}(C)
=\left|\{\operatorname{level}_{\tau}(\ell):\ell\in C\}\right|
$$

| 记录时的文字层号 | 长度 | LBD |
| :--- | ---: | ---: |
| $(1,1,4,4)$ | 4 | 2 |
| $(1,2,4)$ | 3 | 3 |

更短不一定 LBD 更低；低 LBD 也不保证未来更有用。

- **收益**：提前传播，复用推理，避免相同失败。
- **成本**：占用内存，增加监视条目和后续访问。
- **删除责任**：保护有效的原因引用，并考虑搜索进展。

<!-- LBD 依赖计算时的轨迹；不同求解器可能更新记录。表格是两条不同子句的示意，不能从 LBD 推断逻辑强弱。在保留原始公式且学习子句被其蕴含的基本场景，删除学习子句不改变原公式模型集合；这不保证任意删除/重启策略终止。若有等可满足内处理，应使用相应恢复和证明框架。来源：[3] §4.3.1.3；[2] reduceDB。 -->

---

<!-- header: '[传播成本](#3) [搜索控制](#9) **[公式简化](#14)** [效果评估](#20)' -->
<!-- _class: transition -->

03

## 公式简化

变换公式时，同时维护语义、模型恢复和运行状态。

---

<!-- _class: compact -->

## 公式变换保留了什么

### 子句吸收：保持全部模型

$$
(a\lor b)\land(a\lor b\lor c)\equiv(a\lor b).
$$

保留较强的短子句，删除它已经蕴含的较弱子句。

### 纯文字消除：需要恢复取值

$$
F=(p\lor a)\land(\neg a\lor b)
\quad\longrightarrow\quad G=(\neg a\lor b).
$$

$G$ 的模型可通过令 $p=1$ 扩展为 $F$ 的模型。

但 $F$ 也允许 $p=0,a=b=1$：**$p=1$ 是恢复选择，不是必然结论。**

<!-- p 正出现而 ¬p 不出现。F 与 G 等可满足；把 G 当作同一变量集合上的公式时，两者模型集合不同。若应用要求原变量模型，需记录恢复选择；若想保留或枚举全部原始模型，还要使用更强的接口语义。来源：[4] §§9.2.3、9.2.4、9.5。 -->

---

<!-- _class: compact -->

## 有界变量消除：先算归结，再看预算

把涉及 $x$ 的子句分成两组，其余部分记为 $H$：

$$
F=H\land\bigwedge_i(x\lor A_i)\land\bigwedge_j(\neg x\lor B_j).
$$

加入全部非重言归结式，再删除含 $x$ 的子句：

$$
G=H\land\bigwedge_{i,j}(A_i\lor B_j)
\quad\equiv\quad\exists x\;F.
$$

- 正、负出现各 $m,n$ 次，最多需要检查 $mn$ 对候选。
- 简单预算：去重后新增子句数不超过删除数。
- 例如 $m=n=3$：若产生 9 条新子句而只删除 6 条，可拒绝消元。

**预算控制执行成本，归结与存在量化解释语义。**

<!-- H、A_i、B_j 均不含 x；重言归结式可以省略，重复或已存在子句无需重复加入。9 对候选不一定产生 9 条新子句，例子明确假设全为不同的新非重言子句。实际 BVE 还可限制出现次数、长度和工作量，允许有限增长；这里的不增长预算仅是一种规则。来源：[4] §9.3.1。 -->

---

<!-- _class: compact -->

## 连续消去两个变量

$$
\begin{aligned}
F&=(x\lor a)\land(\neg x\lor b)\land(\neg a\lor b)\\[0.35em]
&\xrightarrow{\text{消去 }x}\ G=(a\lor b)\land(\neg a\lor b)\\[0.35em]
&\xrightarrow{\text{消去 }a}\ H=(b).
\end{aligned}
$$

| 消元 | 加入 | 删除并保存到恢复栈 |
| :--- | :--- | :--- |
| $x$ | $(a\lor b)$ | $(x\lor a)$、$(\neg x\lor b)$ |
| $a$ | $(b)$ | $(a\lor b)$、$(\neg a\lor b)$ |

子句数 $3\to2\to1$，两次都符合不增长预算。

求解 $H$ 得到 $b=1$，接下来还需要恢复 $a,x$。

<!-- G≡∃x F，H≡∃a G。消去 a 后的两个 b 去重成为单位子句。此例便于手算模型恢复，未声称这两次变换实际加快了运行；实现也可能用等价的其他推理先得到单位子句。来源：[4] §§9.3.1、9.5.1；例子与配套正式笔记一致。 -->

---

<!-- _class: compact -->

## 按相反顺序恢复模型

```pseudocode
\begin{algorithm}
\caption{Restore Eliminated Variables}
\begin{algorithmic}
\FUNCTION{Restore}{$\alpha,S$}
    \WHILE{$S\ne\varnothing$}
        \STATE $(x,P,N)\gets$ \CALL{Pop}{$S$}
        \STATE $\alpha[x]\gets 0$
        \FORALL{$C\in P$}
            \IF{\CALL{AllFalse}{$C\setminus\{x\},\alpha$}}
                \STATE $\alpha[x]\gets 1$
            \ENDIF
        \ENDFOR
    \ENDWHILE
    \RETURN $\alpha$
\ENDFUNCTION
\end{algorithmic}
\end{algorithm}
```

$b=1\ \Longrightarrow\ a=0\ \Longrightarrow\ x=1$，得到 $(x,a,b)=(1,0,1)$。

教学伪代码：$P,N$ 是消元时保存的正、负出现子句；从栈顶恢复。

<!-- 输入 alpha 满足最终公式，并给所有未被消去的变量赋值；自由变量可先任意补全。AllFalse 对空集合返回真。若正出现子句的其他文字全假，就要求 x=1；不可能同时有负出现子句要求 x=0，否则相应归结式也全假，与已有模型矛盾。因此默认 x=0，只扫描 P 即可。N 的约束由这一论证保证，不是任意丢弃。辅助数据结构未展开，伪代码不能独立运行，也不涵盖其他变换的恢复。本例先恢复 a，因为保存的 x 子句依赖 a。来源：[4] §9.5.1。 -->

---

<!-- _class: compact -->

## 把公式简化安排进搜索

```mermaid
flowchart LR
  S[一段 CDCL 搜索] --> R[回到根层]
  R --> I[有预算的内处理]
  I --> P[维护结构与根层传播]
  P --> S
```

- **运行状态**：监视列表、阻塞文字和原因引用对应变换后的公式。
- **SAT 出口**：保存恢复记录，把模型映射回原问题。
- **UNSAT 出口**：公式变换也需要相应证明信息。
- **增量调用**：未来还要使用的变量，需按接口规则保护或恢复。

内处理可作用于原始子句和学习子句；“公式更小”仍要接受耗时评估。

<!-- 图是一种易解释的调度安排，不是所有内处理方法必须回到根层的断言。完成新的根层传播后才能继续普通决策；其间仍可能发现冲突。单次查询的等可满足性不足以直接保证后续对已消去变量追加约束或假设的语义。来源：[4] §§9.1、9.5；[6] §§3–5。旧资料目录写作 IJCAI_2012_Inprocessing，原论文实际发表于 IJCAR 2012，本演示使用正式出版信息。 -->

---

<!-- header: '[传播成本](#3) [搜索控制](#9) [公式简化](#14) **[效果评估](#20)**' -->
<!-- _class: transition -->

04

## 效果评估

把机制带来的节省和维护它的代价一起计入。

---

<!-- _class: compact -->

## 冲突次数减少，不保证总时间下降

**教学示意数据，非求解器实测。**

| 记录 | 基线 | 改动后 |
| :--- | ---: | ---: |
| 冲突次数 | $100\,000$ | $70\,000$ |
| 传播耗时 | 7 s | 6 s |
| 分析与其余维护 | 2 s | 3 s |
| 预处理与内处理 | 1 s | 3 s |
| 总求解时间 | **10 s** | **12 s** |

冲突减少 $30\%$，但总时间增加 $20\%$。

同时记录传播工作量、子句访问与内存；所需的恢复和验证成本另行报告。

<!-- 各耗时类别互不重叠，表内总时间仅为三个耗时项之和；输入解析等其他成本假设相同或并入“其余维护”。数字是刻意构造的反例，不对应任何求解器/硬件。传播次数、冲突数和子句数都是解释指标，不足以单独证明加速。来源：配套《搜索策略》中的成本分析；[4] §9.1 的整体成本视角。 -->

---

<!-- _class: compact -->

## 消融比较也要保留超时实例

固定实例、版本、编译、参数、硬件、时间上限和随机种子；一次比较先改变一个机制。

**PAR-2 教学算例**：上限 $T=10$ s，成功计实际耗时，超时计 $2T$。

| 同一组实例 | 基线 | 新策略 |
| :--- | ---: | ---: |
| 实例 1 | 2 s | 3 s |
| 实例 2 | 超时 → 20 s | 9 s |
| 平均 PAR-2 | **11 s** | **6 s** |

只看共同解决的实例，会忽略新策略多解决了一个实例。

同时报告解决数、时间分布与结果验证；**超时不等于 UNSAT**。

<!-- 此表完全是教学示例，未运行求解器。两个策略在同一时间上限和实例集下比较；基线(2+20)/2=11，新策略(3+9)/2=6。PAR-2 是一种明确的超时计分约定，不是唯一评价方式；多随机种子时应报告波动，不能挑选最佳一次。先做单机制消融，再检查与其他机制的组合效应。重启实验设计可参考：[5] §§2–4。 -->

---

## 实现优化的三条检查线

1. **语义**：传播、学习和公式变换保留了什么结论？
2. **状态**：trail、监视列表、原因引用和恢复记录是否一致？
3. **成本**：节省的搜索工作是否超过维护与变换开销？

继续阅读：

- <a href="/knowledge/sat-cdcl/" target="_top">CDCL：传播队列与双监视文字</a>
- <a href="/knowledge/sat-search-strategies/" target="_top">搜索策略：分支、重启与子句管理</a>
- <a href="/knowledge/sat-preprocessing/" target="_top">预处理、内处理与模型恢复</a>

下一篇：<a href="/slides/sat-usage/index.html" target="_top">使用 SAT：从约束建模到可信结果</a>。

<!-- 可用三个手算问题复盘：为何 ¬d 的事件未处理时已经能报告冲突？为何 B_t 与 A_t 可以用于同一变量排序？为何先消 x 再消 a，却要先恢复 a？分别对应传播语义、等比例更新和恢复依赖。研究延伸可阅读旧 VSIDS、LRB、Glucose 重启报告；保留论文年份与实验条件。 -->

---

<!-- _class: compact -->

## 参考文献

**[1]** N. Eén, N. Sörensson. *An Extensible SAT-solver.* 2004.\
[DOI](https://doi.org/10.1007/978-3-540-24605-3_37) · [扩展稿 v1.2](https://ai.dmi.unibas.ch/research/reading_group/een-sorensson-sat2003.pdf)

**[2]** MiniSat 核心源码（2013），固定提交 [`37dc6c67`](https://github.com/niklasso/minisat/blob/37dc6c67e2af26379d88ce349eb9c4c6160e8543/minisat/core/Solver.cc)。

**[3]** J. Marques-Silva, I. Lynce, S. Malik. *CDCL SAT Solvers.*\
Handbook of Satisfiability, 2nd ed., ch. 4, 2021. [DOI](https://doi.org/10.3233/FAIA200987)

**[4]** A. Biere, M. Järvisalo, B. Kiesl. *Preprocessing in SAT Solving.*\
同书，ch. 9, 2021. [DOI](https://doi.org/10.3233/FAIA200992)

**[5]** A. Biere, A. Fröhlich. *Evaluating CDCL Restart Schemes.*\
Pragmatics of SAT 2015 and 2018, 2019. [DOI](https://doi.org/10.29007/89dw)

**[6]** M. Järvisalo, M. Heule, A. Biere. *Inprocessing Rules.*\
IJCAR 2012. [DOI](https://doi.org/10.1007/978-3-642-31365-3_28)

<!-- [1] 会议名称为 SAT 2003，论文集出版年为 2004；演讲备注按 23 页扩展稿 v1.2 的章节定位。[3] 正式题名为 Conflict-Driven Clause Learning SAT Solvers。[4] 作者公开的章节预印本：https://fmv.jku.at/papers/BiereJarvisaloKiesl-SAT-Handbook-2021-Preprocessing-Chapter-Manuscript.pdf 。[5] 使用 2019 年正式出版版本，不以 2015 年报告年份代替出版年。[6] 作者稿：https://www.cs.helsinki.fi/matti.jarvisalo/papers/jarvisalo-heule-biere.ijcar12.pdf 。旧报告仅用于组织线索，术语、推理和引用以本演示及上述来源为准。 -->
