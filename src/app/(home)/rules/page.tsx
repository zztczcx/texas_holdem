import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { getLocale } from '@/i18n/dictionaries';

export const metadata: Metadata = {
  title: "How to Play Texas Hold'em — Rules & Guide",
  description:
    "A friendly beginner's guide to Texas Hold'em poker — hand rankings, betting rounds, actions, and tips to get started.",
};

// ---------------------------------------------------------------------------
// Bilingual page content — defined inline to keep the dictionary small
// ---------------------------------------------------------------------------

interface HandRankItem {
  emoji: string;
  name: string;
  example: string;
}

interface StepItem {
  name: string;
  desc: string;
}

interface ActionItem {
  label: string;
  tone: 'danger' | 'neutral' | 'call' | 'raise' | 'all-in';
  desc: string;
}

interface PageContent {
  title: string;
  subtitle: string;
  backHome: string;
  sections: {
    quickStart: { title: string; steps: readonly string[] };
    objective: { title: string; body: string };
    handFlow: { title: string; steps: readonly StepItem[] };
    actions: { title: string; items: readonly ActionItem[] };
    rankings: { title: string; subtitle: string; items: readonly HandRankItem[] };
    buyBack: { title: string; body: string };
    tips: { title: string; items: readonly string[] };
  };
}

const EN_CONTENT: PageContent = {
  title: "How to Play Texas Hold'em",
  subtitle: 'A quick, friendly guide for new players.',
  backHome: '← Back to Home',
  sections: {
    quickStart: {
      title: '⚡ Get Playing in 60 Seconds',
      steps: [
        'Click "Create Table" on the home page, pick a name and table settings.',
        'Share the 6-character code or the invite link with your friends.',
        'Friends visit the site and enter the code (or click the link) to join.',
        'Once everyone is in, the host clicks "Start Game".',
        "That's it — cards are dealt automatically!",
      ],
    },
    objective: {
      title: '🎯 The Objective',
      body: 'Win all the chips at the table. You win chips by either having the best hand at showdown (the final reveal), or by convincing everyone else to fold their cards.',
    },
    handFlow: {
      title: '🃏 How a Hand is Played',
      steps: [
        {
          name: 'Blinds',
          desc: 'Two players post forced bets — the small blind and the big blind — to seed the pot before any cards are dealt.',
        },
        {
          name: 'Hole Cards (Pre-Flop)',
          desc: 'Every player receives 2 private cards, face-down. Only you can see them. A round of betting follows.',
        },
        {
          name: 'The Flop',
          desc: '3 community cards are laid face-up in the centre — shared by everyone. Another round of betting.',
        },
        {
          name: 'The Turn',
          desc: 'A 4th community card is revealed. Another betting round.',
        },
        {
          name: 'The River',
          desc: 'The 5th and final community card is revealed. The last betting round takes place.',
        },
        {
          name: 'Showdown',
          desc: 'If 2 or more players remain, everyone reveals their cards. The best 5-card hand — using any combination of your 2 hole cards and the 5 community cards — wins the pot.',
        },
      ],
    },
    actions: {
      title: '🕹️ Your Actions',
      items: [
        {
          label: 'Fold',
          tone: 'danger',
          desc: 'Give up your hand. You lose any chips already bet this round, but risk no more.',
        },
        {
          label: 'Check',
          tone: 'neutral',
          desc: "Pass the action to the next player. Only available when nobody has bet yet this round.",
        },
        {
          label: 'Call',
          tone: 'call',
          desc: 'Match the current highest bet to stay in the hand.',
        },
        {
          label: 'Raise',
          tone: 'raise',
          desc: 'Increase the bet. Everyone else must call your raise, re-raise, or fold.',
        },
        {
          label: 'All-In',
          tone: 'all-in',
          desc: 'Bet every chip you have. You can still win the pot proportional to what you put in.',
        },
      ],
    },
    rankings: {
      title: '🏆 Hand Rankings',
      subtitle: 'Best hand wins. From strongest (1) to weakest (10):',
      items: [
        { emoji: '🥇', name: 'Royal Flush',     example: 'A K Q J 10 ♠' },
        { emoji: '🃏', name: 'Straight Flush',  example: '7 8 9 10 J ♥' },
        { emoji: '4️⃣', name: 'Four of a Kind',  example: 'K K K K 3' },
        { emoji: '🏠', name: 'Full House',       example: 'Q Q Q 9 9' },
        { emoji: '♦️', name: 'Flush',            example: '2 5 8 J A ♦' },
        { emoji: '➡️', name: 'Straight',         example: '4 5 6 7 8' },
        { emoji: '3️⃣', name: 'Three of a Kind', example: 'J J J 5 2' },
        { emoji: '👥', name: 'Two Pair',         example: 'A A 8 8 K' },
        { emoji: '👯', name: 'One Pair',          example: 'K K 9 4 2' },
        { emoji: '📈', name: 'High Card',        example: 'A J 9 6 3' },
      ],
    },
    buyBack: {
      title: '💰 Buy-Backs',
      body: "If the host has enabled buy-backs, you can re-enter the game when your chips hit zero — for the same starting amount. The host configures this when creating the table.",
    },
    tips: {
      title: '💡 Tips for New Players',
      items: [
        "You don't have to win every hand — folding a weak hand early saves chips.",
        "Pay attention to the community cards. They're shared; someone else might have a better hand.",
        "A big raise often means a strong hand — or a calculated bluff. Watch the betting patterns.",
        'Use the bet slider to choose your exact raise amount.',
        'The dealer button (D), small blind (SB), and big blind (BB) badges show your position.',
        'Positions rotate every hand — so blinds are shared fairly.',
      ],
    },
  },
};

const ZH_CONTENT: PageContent = {
  title: '德州扑克玩法指南',
  subtitle: '为新玩家准备的简明友好教程。',
  backHome: '← 返回首页',
  sections: {
    quickStart: {
      title: '⚡ 60秒快速上手',
      steps: [
        '在首页点击"创建牌桌"，输入名字并设置桌面参数。',
        '将6位桌号或邀请链接分享给朋友。',
        '朋友打开网站，输入桌号（或直接点击链接）加入牌桌。',
        '所有人就位后，房主点击"开始游戏"。',
        '就这么简单——系统会自动发牌！',
      ],
    },
    objective: {
      title: '🎯 游戏目标',
      body: '赢得桌上所有筹码。通过在摊牌时持有最佳牌型，或让所有其他玩家弃牌，即可赢取底池。',
    },
    handFlow: {
      title: '🃏 一手牌的完整流程',
      steps: [
        {
          name: '盲注',
          desc: '发牌前，两位玩家须强制下注——小盲注与大盲注——用于建立底池。',
        },
        {
          name: '底牌阶段（翻牌前）',
          desc: '每位玩家获发2张私人底牌，只有自己可见。随后进行第一轮下注。',
        },
        {
          name: '翻牌（Flop）',
          desc: '桌面翻开3张公共牌，所有玩家共用。随后进行下注。',
        },
        {
          name: '转牌（Turn）',
          desc: '翻开第4张公共牌，随后进行下注。',
        },
        {
          name: '河牌（River）',
          desc: '翻开第5张也是最后一张公共牌，进行最后一轮下注。',
        },
        {
          name: '摊牌（Showdown）',
          desc: '若河牌下注后仍有2名或以上玩家，所有人亮牌。用2张底牌与5张公共牌中任意组合出的最佳5张牌型，赢得底池。',
        },
      ],
    },
    actions: {
      title: '🕹️ 下注操作',
      items: [
        {
          label: '弃牌（Fold）',
          tone: 'danger',
          desc: '放弃本手牌。本轮已下注的筹码将损失，但不再有进一步风险。',
        },
        {
          label: '过牌（Check）',
          tone: 'neutral',
          desc: '不下注，将操作权传给下一位玩家。仅在本轮无人下注时可用。',
        },
        {
          label: '跟注（Call）',
          tone: 'call',
          desc: '跟进当前最高注额，继续参与本手牌。',
        },
        {
          label: '加注（Raise）',
          tone: 'raise',
          desc: '提高注额。其他玩家须跟注、再加注或弃牌。',
        },
        {
          label: '全押（All-In）',
          tone: 'all-in',
          desc: '押上全部筹码。您仍可按比例赢取您所参与部分的底池。',
        },
      ],
    },
    rankings: {
      title: '🏆 牌型大小',
      subtitle: '最大牌型获胜。从最强（1）到最弱（10）：',
      items: [
        { emoji: '🥇', name: '皇家同花顺', example: 'A K Q J 10 ♠' },
        { emoji: '🃏', name: '同花顺',     example: '7 8 9 10 J ♥' },
        { emoji: '4️⃣', name: '四条',       example: 'K K K K 3' },
        { emoji: '🏠', name: '葫芦',        example: 'Q Q Q 9 9' },
        { emoji: '♦️', name: '同花',        example: '2 5 8 J A ♦' },
        { emoji: '➡️', name: '顺子',        example: '4 5 6 7 8' },
        { emoji: '3️⃣', name: '三条',       example: 'J J J 5 2' },
        { emoji: '👥', name: '两对',        example: 'A A 8 8 K' },
        { emoji: '👯', name: '一对',        example: 'K K 9 4 2' },
        { emoji: '📈', name: '高牌',        example: 'A J 9 6 3' },
      ],
    },
    buyBack: {
      title: '💰 回购',
      body: '若房主开启了回购功能，当您筹码归零时可以用初始筹码重新加入游戏。此设置由房主在创建牌桌时配置。',
    },
    tips: {
      title: '💡 新手技巧',
      items: [
        '无需赢下每手牌——手牌弱时尽早弃牌可以保存筹码。',
        '留意公共牌。所有玩家共用这5张牌，别人可能持有更强的牌型。',
        '大额加注通常意味着强牌——或是高明的虚张声势。注意观察下注模式。',
        '使用下注滑块精确控制加注金额。',
        '庄家（D）、小盲（SB）和大盲（BB）标记会显示您的位置。',
        '每手牌结束后位置顺时针轮换，让盲注公平分摊。',
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Tone styles for the action badges
// ---------------------------------------------------------------------------

const ACTION_TONE_CLASS: Record<ActionItem['tone'], string> = {
  danger: 'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border-[var(--color-danger)]/25',
  neutral: 'bg-[var(--color-border-muted)]/60 text-[var(--color-text-muted)] border-[var(--color-border-muted)]',
  call: 'bg-[var(--color-felt)]/15 text-[var(--color-success)] border-[var(--color-felt)]/30',
  raise: 'bg-[var(--color-gold)]/12 text-[var(--color-gold)] border-[var(--color-gold)]/30',
  'all-in': 'bg-[var(--color-gold)]/20 text-[var(--color-gold)] border-[var(--color-gold)]/50',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RulesPage(): Promise<React.ReactElement> {
  const locale = await getLocale();
  const c = locale === 'zh' ? ZH_CONTENT : EN_CONTENT;

  return (
    <PageContainer className="py-10 px-4 md:py-14">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
      >
        {c.backHome}
      </Link>

      {/* Page hero */}
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)] leading-tight">
          {c.title}
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)] text-lg">{c.subtitle}</p>
      </header>

      <div className="flex flex-col gap-10 max-w-3xl">

        {/* ── Quick Start ── */}
        <section aria-labelledby="qs-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="qs-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
            {c.sections.quickStart.title}
          </h2>
          <ol className="flex flex-col gap-3">
            {c.sections.quickStart.steps.map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-felt)] text-[var(--color-text-primary)] text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Objective ── */}
        <section aria-labelledby="obj-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="obj-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
            {c.sections.objective.title}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {c.sections.objective.body}
          </p>
        </section>

        {/* ── Hand Flow ── */}
        <section aria-labelledby="flow-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="flow-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
            {c.sections.handFlow.title}
          </h2>
          <ol className="relative flex flex-col gap-0">
            {c.sections.handFlow.steps.map((step, i) => (
              <li key={i} className="flex gap-4 pb-5 last:pb-0">
                {/* Timeline line */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-7 h-7 rounded-full bg-[var(--color-felt)] text-[var(--color-text-primary)] text-xs font-bold flex items-center justify-center z-10">
                    {i + 1}
                  </span>
                  {i < c.sections.handFlow.steps.length - 1 && (
                    <div className="w-px flex-1 bg-[var(--color-border-muted)] mt-1" />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">{step.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Actions ── */}
        <section aria-labelledby="actions-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="actions-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
            {c.sections.actions.title}
          </h2>
          <ul className="flex flex-col gap-4">
            {c.sections.actions.items.map((action) => (
              <li key={action.label} className="flex gap-3 items-start">
                <span
                  className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full border text-xs font-bold tracking-wide ${ACTION_TONE_CLASS[action.tone]}`}
                >
                  {action.label}
                </span>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{action.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Hand Rankings ── */}
        <section aria-labelledby="rankings-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="rankings-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            {c.sections.rankings.title}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">{c.sections.rankings.subtitle}</p>
          <ol className="flex flex-col gap-2">
            {c.sections.rankings.items.map((item, i) => (
              <li
                key={item.name}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                  i === 0
                    ? 'bg-[var(--color-gold)]/10 border-[var(--color-gold)]/30'
                    : 'bg-[var(--color-canvas)] border-[var(--color-border-muted)]'
                }`}
              >
                <span className="text-sm font-bold text-[var(--color-text-muted)] w-5 text-center shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <span className="text-lg shrink-0" aria-hidden="true">{item.emoji}</span>
                <span className={`text-sm font-semibold shrink-0 ${i === 0 ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]'}`}>
                  {item.name}
                </span>
                <span className="ml-auto text-xs font-mono text-[var(--color-text-muted)] shrink-0">
                  {item.example}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Buy-Back ── */}
        <section aria-labelledby="buyback-heading" className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-6 md:p-8">
          <h2 id="buyback-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
            {c.sections.buyBack.title}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {c.sections.buyBack.body}
          </p>
        </section>

        {/* ── Tips ── */}
        <section aria-labelledby="tips-heading" className="rounded-3xl bg-[var(--color-felt)]/10 border border-[var(--color-felt)]/25 p-6 md:p-8">
          <h2 id="tips-heading" className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
            {c.sections.tips.title}
          </h2>
          <ul className="flex flex-col gap-3">
            {c.sections.tips.items.map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="shrink-0 text-[var(--color-gold)] text-sm font-bold mt-0.5">✓</span>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{tip}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── CTA ── */}
        <div className="flex gap-3 justify-center pb-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold bg-[var(--color-felt)] text-[var(--color-text-primary)] hover:bg-[#245a40] transition-colors"
          >
            ♠ {locale === 'zh' ? '开始游戏' : "Let's Play"}
          </Link>
        </div>

      </div>
    </PageContainer>
  );
}
