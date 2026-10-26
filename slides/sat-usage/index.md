---
marp: true
title: 使用 SAT：从约束建模到可信结果
description: 用两人两班的排班例子串起 CNF 编码、假设与激活文字、不可满足核心，以及 SAT 模型和 UNSAT 证据的检查。
theme: cinderfolio
size: 16:9
sizes: ["16:9", "4:3"]
math: mathjax
lang: zh-CN
paginate: true
transition: fade 300ms
header: '[约束建模](#3) [增量查询](#7) [冲突解释](#11) [结果验证](#15)'
footer: ShiJin · 使用 SAT
---

<!-- _class: cover -->
<!-- _paginate: skip -->
<!-- _header: "" -->
<!-- _footer: "" -->

# 使用 SAT <small>从约束建模到可信结果</small>

一个排班问题的完整求解与验证

ShiJin · 2026 年 10 月

<!-- 前置知识：布尔变量、文字、子句与单位传播。不要求掌握求解器的内部实现。全文沿用同一个排班例子，区分业务变量、控制约束组的选择变量，以及每次调用的临时假设。核心缩减与 RUP 检查使用教学伪代码，依赖的接口和数据结构不展开。 -->

---

## 一次求解需要保留哪些对应关系

```mermaid
flowchart LR
  R[业务要求] --> F[带开关的 CNF]
  F --> Q[按假设求解]
  Q --> V[检查与解释]
```

1. **[约束建模](#3)**：变量和子句分别表示什么？
2. **[增量查询](#7)**：哪些约束永久保留，哪些要求本次才开启？
3. **[冲突解释](#11)**：哪些要求已经足以导致无解？
4. **[结果验证](#15)**：怎样检查模型或反证，结论又覆盖到哪里？

<!-- 从业务到 CNF 需要编码语义；从 CNF 到一次查询需要精确的永久子句和假设；从模型回到排班需要变量映射。检查器验证的是提交的具体公式与证据，业务编码本身还需要独立核对。来源：[1] §2.2；[2] §4.4.1；[4] §15.1。 -->

---

<!-- header: '**[约束建模](#3)** [增量查询](#7) [冲突解释](#11) [结果验证](#15)' -->
<!-- _class: transition -->

01

## 约束建模

先明确变量含义，再逐条表达实际要求。

---

<!-- _class: compact -->

## 两人两班：每班恰好一人

| 业务变量 | 第 1 班 | 第 2 班 |
| :--- | :--- | :--- |
| 甲承担这一班 | $a_1$ | $a_2$ |
| 乙承担这一班 | $b_1$ | $b_2$ |

变量取 $1$ 表示承担，取 $0$ 表示不承担。背景约束为：

$$
B=\bigwedge_{i=1}^{2}
\bigl(\underbrace{(a_i\lor b_i)}_{\text{至少一人}}
\land\underbrace{(\neg a_i\lor\neg b_i)}_{\text{至多一人}}\bigr).
$$

只写第一项会允许两人同时上同一班；只写第二项会允许空班。

**每班恰好一人，不等于每人恰好上一班。**

<!-- 本例只有两名候选人，恰好一人直接编码为一个正子句和一个负子句。更多候选人的至多一人约束需要其他编码，不能照搬“所有变量取反放在同一子句”来表达至多一人。B 允许同一人承担两班；人员负担限制由后面的可选组加入。来源：[1]；排班例子来自配套《增量 SAT 与建模实践》。 -->

---

## 为四组可选要求保留业务名称

| 组 | 要求 | 对应子句 |
| :--- | :--- | :--- |
| $G_1$ | 甲至多承担一班 | $(\neg a_1\lor\neg a_2)$ |
| $G_2$ | 乙至多承担一班 | $(\neg b_1\lor\neg b_2)$ |
| $G_3$ | 甲不能承担第 1 班 | $(\neg a_1)$ |
| $G_4$ | 甲不能承担第 2 班 | $(\neg a_2)$ |

背景约束 $B$ 始终生效；每次查询可以选择开启哪些 $G_i$。

记录“组名 ↔ 子句 ↔ 变量”的映射，才能把后续冲突解释回业务要求。

<!-- 每组在本例中恰好只有一个子句；一般一组可以含多个子句。组的划分决定冲突解释的粒度。G1、G2 只限制各自最多一班，并不单独要求各自必须上一班。四组同时开启时的矛盾将在后面推导，不把相互冲突的可选要求提前当成永久背景。来源：[2] §§4.4.1.2–4.4.1.3。 -->

---

<!-- _class: compact -->

## 激活文字让一组要求可开可关

为 $G_i$ 引入新选择变量 $s_i$，把组内每个子句 $C$ 变成 $\neg s_i\lor C$：

$$
F=B\land\bigwedge_{i=1}^{4}\ \bigwedge_{C\in G_i}(\neg s_i\lor C).
$$

例如 $G_3$ 变成 $(\neg s_3\lor\neg a_1)$。

| 本次假设 | 保护子句的作用 |
| :--- | :--- |
| $s_3=1$ | $\neg s_3$ 为假，必须满足 $\neg a_1$：开启要求 |
| $s_3=0$ | $\neg s_3$ 为真，整个子句已满足：关闭要求 |

永久加入的是带保护的子句；查询时通过**临时假设**选择开关。

<!-- s_i 与业务变量不同，只在对应组中作为负保护文字出现。若省略 s_i 的假设，也允许求解器取 s_i=0，所以不会强制开启该组；省略不意味着返回模型必定把它取为 0。普通查询显式给出正负假设以明确状态；后面的核心查询只给出保留的假设。若选择变量被用于无关约束，上述关闭解释需重新检查。来源：[2] §4.4.1.2；[3] ipasir_add、ipasir_assume。 -->

---

<!-- header: '[约束建模](#3) **[增量查询](#7)** [冲突解释](#11) [结果验证](#15)' -->
<!-- _class: transition -->

02

## 增量查询

保持永久公式，改变本次需要满足的条件。

---

<!-- _class: compact -->

## 第一次查询：得到可行排班

开启 $G_1,G_2,G_3$，关闭 $G_4$：

$$
A_1=\{s_1,s_2,s_3,\neg s_4\},
\qquad Q_1=F\land\bigwedge_{\ell\in A_1}(\ell).
$$

$$
\underbrace{a_1=0}_{G_3}
\xRightarrow{B}b_1=1
\xRightarrow{G_2}b_2=0
\xRightarrow{B}a_2=1.
$$

| 班次 | 甲 | 乙 |
| :--- | :---: | :---: |
| 第 1 班 | 不承担 | 承担 |
| 第 2 班 | 承担 | 不承担 |

得到业务赋值 $(a_1,b_1,a_2,b_2)=(0,1,1,0)$；还需保留完整模型中的选择变量。

<!-- 每一步都由已开启组或背景约束进行单位传播。G1 也满足，因为甲只承担第 2 班；G4 被关闭，所以 a2=1 不违背本次要求。完整模型为业务赋值 (0,1,1,0) 与选择变量 (1,1,1,0)，满足 F 和全部 A1。来源：配套笔记的第一次查询；[3] 假设接口语义。 -->

---

<!-- _class: compact -->

## 第二次查询：同一个公式出现冲突

改为开启全部要求：$A_2=\{s_1,s_2,s_3,s_4\}$。

```mermaid
flowchart LR
  A[甲不能上第 1 班] -->|每班恰好一人| B[乙上第 1 班]
  C[甲不能上第 2 班] -->|每班恰好一人| D[乙上第 2 班]
  B --> E[与乙至多一班冲突]
  D --> E
```

这次得到的是 $F\land\bigwedge_{\ell\in A_2}(\ell)$ **不可满足**。

$F$ 本身仍可满足：关闭所有选择变量后，只需满足背景 $B$。

重新提交 $A_1$，仍然可以得到前一页的排班。

<!-- 两次查询之间没有改变永久公式，也没有追加永久单位子句。新一次 ipasir_solve 之前需要重新提交想使用的全部假设。比如关闭全部组、令甲承担两班就能满足 F，说明第二次 UNSAT 不代表 F 无解。这里的图只用于解释这次矛盾，不是一般的 CDCL 蕴含图。 -->

---

<!-- _class: compact -->

## 接口调用中区分永久约束与临时假设

| IPASIR 操作 | 含义与读取时机 |
| :--- | :--- |
| `add` | 逐文字添加永久子句，以 `0` 结束一个子句 |
| `assume` | 添加下一次求解的假设；每次 `solve` 后清空 |
| `solve` | 返回 `10`：SAT；`20`：UNSAT；`0`：中止、未获结论 |
| `val` / `failed` | 分别在 SAT / UNSAT 后读取模型或本次假设的冲突标记 |

新一次 `add` 或 `assume` 会改变接口状态，先读取并保存上次结果。

- 临时要求不能误用 `add` 作为永久单位子句加入。
- `val` 返回 `0` 不表示文字为假；需按模型约定补全并检查。
- 返回 `0` 或超时，不提供 UNSAT 结论。

<!-- 表内省略所有函数名共同的 ipasir_ 前缀。依据 2020 年比赛存档头文件：[3]。add 和 assume 从 INPUT/SAT/UNSAT 状态进入 INPUT；val 只在 SAT 状态，failed 只在 UNSAT 状态有效。读取结果后再为下次调用添加假设。这里不声称基本 IPASIR 接口直接输出证明；证明导出须使用求解器另行提供且支持该模式的接口。 -->

---

<!-- header: '[约束建模](#3) [增量查询](#7) **[冲突解释](#11)** [结果验证](#15)' -->
<!-- _class: transition -->

03

## 冲突解释

找出已经足以矛盾的要求，再判断能否继续删减。

---

<!-- _class: compact -->

## 不可满足核心与解释的粒度

假设核心 $K\subseteq A$ 只需满足：

$$
F\land\bigwedge_{\ell\in K}(\ell)\ \text{不可满足}.
$$

本例 $K=\{s_2,s_3,s_4\}$：乙至多一班，但甲两班都不能上。

| 要求 | 保证什么 |
| :--- | :--- |
| 不可满足核心 | 这些假设已经足以冲突 |
| 子集极小核心 | 再删除任何一项，都会变为可满足 |
| 最小核心 | 在所有核心中，元素数全局最少 |

这里解释的是**相对于固定背景 $B$ 的约束组**；返回核心不自动保证极小或最小。

<!-- F 包含背景和带保护的四组子句。因选择变量只作为各自负保护文字出现，未假设开启的组可以关闭。G1 与本例矛盾无关。一般的组核心不保证每组内部子句的粒度也极小。最小核心一定子集极小，反过来不成立。只有拿到一个核心不能直接宣布获得最小解释。来源：[2] §4.4.1.3；[3] ipasir_failed。 -->

---

## 用额外查询缩减核心

```pseudocode
\begin{algorithm}
\caption{Deletion-Based Core Reduction}
\begin{algorithmic}
\FUNCTION{ReduceCore}{$F,K$}
    \STATE $U\gets K$
    \FORALL{$\ell\in\operatorname{Snapshot}(U)$}
        \STATE $r\gets$ \CALL{SolveUnder}{$F,U\setminus\{\ell\}$}
        \IF{$r=\mathrm{UNSAT}$}
            \STATE $U\gets U\setminus\{\ell\}$
        \ELIF{$r=\mathrm{UNKNOWN}$}
            \RETURN $(U,\mathrm{false})$
        \ENDIF
    \ENDFOR
    \RETURN $(U,\mathrm{true})$
\ENDFUNCTION
\end{algorithmic}
\end{algorithm}
```

教学伪代码：固定 $F$，输入已确认无解的核心；辅助接口未展开。

返回的 true 表示已确认**子集极小**；UNKNOWN 时保留当前核心。

<!-- SolveUnder 每次仅提交给定的临时假设，不改变永久公式，也不继承上次假设。Snapshot 固定初始遍历顺序。若某项试删得到 SAT，之后只会移除更多假设，使公式更弱，所以当时的满足赋值仍然有效；一次遍历就足以验证最终核心中每项不可再删。遇到 UNKNOWN，返回 U 仍是已知不可满足的核心，但极小性尚未确认。算法最多进行 |K| 次额外调用，不保证全局最少元素或很短的总时间。依据配套《增量 SAT 与建模实践》中的缩减算法。 -->

---

<!-- _class: compact -->

## 在排班问题上手算一次缩减

从 $U=\{s_1,s_2,s_3,s_4\}$ 开始，按 $s_1,s_2,s_3,s_4$ 试删。

| 试删 | 剩余要求的结果 | 处理 | 可满足时的排班见证 |
| :--- | :--- | :--- | :--- |
| $s_1$ | UNSAT | 删除 | — |
| $s_2$ | SAT | 保留 | 乙承担两班 |
| $s_3$ | SAT | 保留 | 甲第 1 班，乙第 2 班 |
| $s_4$ | SAT | 保留 | 乙第 1 班，甲第 2 班 |

最终留下 $\{s_2,s_3,s_4\}$，每一项都有“删去后可满足”的见证。

**一次遍历得到子集极小核心；算法本身不保证元素数全局最少。**

<!-- 删除 s1 后 U={s2,s3,s4}；之后三个试删均得到 SAT，因此 U 不再变化。三次见证的业务赋值依次为 (a1,b1,a2,b2)=(0,1,0,1)、(1,0,0,1)、(0,1,1,0)。未列入试验假设的选择变量可设为 0。整个过程对同一 F 调用，不把试删时的 SAT 模型误解释为满足所有四组要求的模型。本例的具体核心大小不代表删除式算法对一般实例能保证最小。 -->

---

<!-- header: '[约束建模](#3) [增量查询](#7) [冲突解释](#11) **[结果验证](#15)**' -->
<!-- _class: transition -->

04

## 结果验证

SAT 检查满足赋值，UNSAT 检查与本次查询对应的反证。

---

<!-- _class: compact -->

## SAT：先检查完整模型，再读回排班

第一次查询的模型为：

$$
(a_1,b_1,a_2,b_2)=(0,1,1,0),\qquad
(s_1,s_2,s_3,s_4)=(1,1,1,0).
$$

| 检查对象 | 这个模型如何满足它 |
| :--- | :--- |
| 背景约束 $B$ | 每班各有且只有一人 |
| 已开启的 $G_1,G_2,G_3$ | 两人各上一班；甲不上第 1 班 |
| $G_4$ 的保护子句 | $s_4=0$，保护文字 $\neg s_4$ 为真 |
| 本次假设 $A_1$ | 四个选择变量与开关设置一致 |

逐子句检查 $Q_1$ 中至少有一个真文字，再把业务变量投影为排班。

若求解前消去了变量，先恢复原变量模型；编码辅助变量也不能随意漏掉。

<!-- 这里的 Q1 是原始输入 F 加上本次假设作为单位子句，不只检查求解器内部简化后的数据库。给定完整赋值后，检查成本与输入文字出现总数线性相关，不意味着寻找模型也线性。若使用 Tseitin 等扩展编码，要核对辅助变量的定义与模型投影；本排班例子无需 Tseitin 辅助变量，s_i 是控制要求的选择变量。来源：[1] §2.2；[2] §4.4.1.4；[4] §15.1。 -->

---

<!-- _class: compact -->

## UNSAT：把核心变成可检查的结论

候选子句 $C^\star=(\neg s_2\lor\neg s_3\lor\neg s_4)$。

**RUP 检查**：临时令候选子句全假，即假设 $s_2,s_3,s_4$ 为真。

$$
\underbrace{a_1=a_2=0}_{G_3,G_4}
\xRightarrow{B}b_1=b_2=1
\xRightarrow{G_2}\bot.
$$

单位传播产生冲突，所以 $F\models C^\star$。

对于第二次查询 $Q_2=F\land\bigwedge_{\ell\in A_2}(\ell)$，可以检查序列：

$$
\pi=(C^\star,\varnothing).
$$

加入 $C^\star$ 后，$A_2$ 的单位假设使它全假，因而可以接受空子句。

<!-- RUP 是 reverse unit propagation：否定待检查子句的每个文字，再执行普通单位传播；通过时说明当前公式蕴含该子句。此处先在 F 上验证 C*，所以它也可跨这些查询保留，而非把 s2、s3、s4 当作永久事实。对 Q2 的两步 RUP 序列，第一步仍有效，第二步在已经验证的子句和查询假设下传播到冲突。本例 Q2 本身就能由单位传播判 UNSAT，这不是最短证明，保留中间子句只为展示可复用结论与查询反证的区别。来源：[4] §15.2.2；[5] §2。 -->

---

## 只检查 RUP 添加步骤的教学检查器

```pseudocode
\begin{algorithm}
\caption{Checking a RUP Refutation}
\begin{algorithmic}
\FUNCTION{CheckRUP}{$Q,\pi$}
    \FORALL{$C\in\pi$}
        \STATE $A\gets\{\neg\ell:\ell\in C\}$
        \IF{\NOT \CALL{PropagateConflict}{$Q,A$}}
            \RETURN $\mathrm{false}$
        \ENDIF
        \STATE $Q\gets Q\cup\{C\}$
        \IF{$C=\varnothing$}
            \RETURN $\mathrm{true}$
        \ENDIF
    \ENDFOR
    \RETURN $\mathrm{false}$
\ENDFUNCTION
\end{algorithmic}
\end{algorithm}
```

教学伪代码：$Q$ 已包含本次查询假设；每步从新的临时赋值开始。

只有接受有效空子句才返回 true；辅助过程只做单位传播。

<!-- pi 是有序序列，FOR ALL 按记录顺序遍历。PropagateConflict 同时处理 Q 的单位子句和 A 的单位假设，包括相反单位或空子句的初始冲突；每轮丢弃临时赋值，已接受的子句继续保留。没有通过 RUP 规则不能推出候选不被蕴含，也不能据此宣布 Q 为 SAT。解析与传播实现未展开，伪代码不能独立运行，不接受删除或一般 RAT 步骤。来源：[4] §15.2.2；[5] §2。 -->

---

<!-- _class: compact -->

## 证明规则、格式与可信边界

<div class="cf-cols">
<div class="cf-col">

### 记录怎样接受检查

- **RUP**：否定候选子句后，单位传播得到冲突。
- **DRAT**：允许 RAT 添加与删除，针对变化中的数据库检查。
- **LRAT**：提供子句编号与推理提示；提示本身仍需核验。

</div>
<div class="cf-col">

### 检查通过意味着什么

- 证据对应的是这份输入、这次假设和指定的证明规则。
- 预处理也要有模型恢复或相应证明记录。
- 编码错误不会因求解器或检查器正确而自动消失。

</div>
</div>

完整推导：<a href="/knowledge/sat-incremental-solving/" target="_top">增量 SAT 与建模实践</a> · <a href="/knowledge/sat-result-verification/" target="_top">结果验证与不可满足证明</a>

回顾：<a href="/slides/sat-cdcl/index.html" target="_top">DPLL 到 CDCL</a> · <a href="/slides/sat-implementation/index.html" target="_top">求解器实现与优化</a> · <a href="/knowledge/sat/" target="_top">专题阅读路线</a>

<!-- RAT 添加不必保持全部模型；证明中的删除也不能简单说成保持等可满足，但整个合法反证保留了从终态无解反推初始公式无解所需的方向。LRAT 同时支持带提示的 RUP 和 RAT 步骤，形式化检查器的保证还需核对其解析、逻辑核心与执行环境范围。若独立验证核心 K，应提交 F∧所有 K 中的单位假设的证据；failed 标记本身不是已经独立验证的证明。本演示的结论不是某一实现的通用正确性声明。来源：[4] §§15.2.4、15.2.5、15.5；[5] §§3–6。 -->

---

<!-- _class: compact -->

## 参考文献

**[1]** S. Prestwich. *CNF Encodings.*\
Handbook of Satisfiability, 2nd ed., ch. 2, 2021. [DOI](https://doi.org/10.3233/FAIA200985)

**[2]** J. Marques-Silva, I. Lynce, S. Malik.\
*Conflict-Driven Clause Learning SAT Solvers.* 同书，ch. 4, 2021. [DOI](https://doi.org/10.3233/FAIA200987)

**[3]** *IPASIR: Generic Incremental SAT API.*\
SAT Competition 2020 存档接口。[ipasir.h](https://satcompetition.github.io/2020/downloads/ipasir.h)

**[4]** M. J. H. Heule. *Proofs of Unsatisfiability.*\
Handbook of Satisfiability, 2nd ed., ch. 15, 2021. [DOI](https://doi.org/10.3233/FAIA200998)

**[5]** L. Cruz-Filipe, M. Heule, W. Hunt, M. Kaufmann, P. Schneider-Kamp.\
*Efficient Certified RAT Verification.* CADE 2017. [DOI](https://doi.org/10.1007/978-3-319-63046-5_14) · [作者稿](https://www.cs.cmu.edu/~mheule/publications/lrat.pdf)

<!-- [1]、[2]、[4] 均使用 2021 年第二版 Handbook 的章节编号。[3] 2020 指接口存档年份，不是 IPASIR 最初提出年份；本演示核对了 add、assume、solve、val、failed 的注释与状态约定。[5] 出版信息采用 CADE 2017，作者稿只按章节定位。排班模型、核心缩减和 RUP 推演是本专题的教学例子。 -->
