import { Activity, BarChart3, Search, Unplug } from 'lucide-react';
import { motion } from 'framer-motion';
import { Section } from './layout/Section';

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
  return <Section
    id="relation-removal-workflow"
    eyebrow="Relation-removal workflow"
    title="How does DGraInsight analyze a relation?"
    intro="A learned relation weight alone does not show how removing that relation changes forecast performance. DGraInsight removes the relation within its native model context, re-executes the fixed pretrained model and compares the resulting forecast errors."
  >
    <motion.div
      className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12 } },
      }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute left-[8%] right-[8%] top-7 hidden h-0.5 origin-left bg-gradient-to-r from-[#16827f] via-[#263b59] to-[#8a5b28] xl:block"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      {steps.map(({ number, title, body, icon: Icon, tone }) => <motion.article
        key={number}
        className="card relative flex min-h-[260px] flex-col p-6 transition-shadow hover:shadow-lg"
        variants={{
          hidden: { opacity: 0, y: 24 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
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
    <motion.p
      className="mt-5 rounded-xl border border-line bg-[#fafbfd] px-5 py-4 text-[14px] leading-7 text-ink-500"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.35, duration: 0.5 }}
    >
      Results describe the selected model, checkpoint, relation, context and removal scope. An average improvement does not mean that every forecasting origin improves.
    </motion.p>
  </Section>;
}
