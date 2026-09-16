import { Activity, BarChart3, Search, Unplug } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Inspect the relation',
    body: 'Select a forecasting model, forecasting origin, native graph context and learned relation.',
    icon: Search,
    tone: 'bg-[#edf7f6] text-[#14736f]',
  },
  {
    number: '02',
    title: 'Remove and re-execute',
    body: 'Start from the original relation structure, remove the selected relation and re-execute the model using the same checkpoint and input.',
    icon: Unplug,
    tone: 'bg-[#eef2f7] text-[#263b59]',
  },
  {
    number: '03',
    title: 'Compare forecast errors',
    body: 'Compare the baseline and relation-removed forecasts against the same ground truth using MAE and MSE.',
    icon: BarChart3,
    tone: 'bg-[#f8f2e8] text-amber-800',
  },
  {
    number: '04',
    title: 'Assess consistency',
    body: 'Compare the direction of the error change across valid forecasting origins: improved, degraded or little change.',
    icon: Activity,
    tone: 'bg-[#f3eef8] text-violet-800',
  },
];

export function RelationRemovalWorkflow() {
  return <section id="relation-removal-workflow" className="border-b border-line bg-white px-5 py-14">
    <div className="mx-auto max-w-[1400px]">
      <motion.p
        className="max-w-5xl border-l-4 border-accent bg-[#edf7f6] px-6 py-5 font-serif text-[20px] font-medium leading-relaxed text-[#263b59] md:text-[23px]"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        Graph-based time-series forecasting models use graph structures to represent relationships among nodes. However, learned relation weights alone may not fully reflect how forecasting performance changes after a relation is removed.
      </motion.p>
      <div className="mt-10"><div className="eyebrow mb-3">Relation-removal workflow</div><h2 className="font-serif text-[28px] font-semibold leading-tight">How does DGraInsight analyze a relation?</h2></div>
    <motion.div
      className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.24 } },
      }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute left-[8%] right-[8%] top-7 hidden h-0.5 origin-left bg-gradient-to-r from-[#16827f] via-[#263b59] to-[#8a5b28] xl:block"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />
      {steps.map(({ number, title, body, icon: Icon, tone }) => <motion.article
        key={number}
        className="card relative flex min-h-[260px] flex-col p-6 transition-shadow hover:shadow-lg"
        variants={{
          hidden: { opacity: 0, y: 24 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: 'easeOut' } },
        }}
        whileHover={{ y: -6 }}
      >
        <div className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full ${tone}`}>
          <Icon size={23}/>
        </div>
        <div className="mt-5 font-mono text-[12px] font-semibold tracking-[0.12em] text-accent">{number}</div>
        <h3 className="mt-2 text-[20px] font-semibold leading-snug">{title}</h3>
        <p className="mt-3 text-[14px] leading-7 text-ink-500">{body}</p>
      </motion.article>)}
    </motion.div>
    </div>
  </section>;
}
