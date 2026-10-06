export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl">
        <span className="app-gradient-text">{title}</span>
      </h1>
      {description && <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  )
}
