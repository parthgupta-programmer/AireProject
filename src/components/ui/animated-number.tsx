import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

interface Props {
  value: number
  decimals?: number
  className?: string
}

/** Counts smoothly from the previous value to the new one. Jumps straight there if motion is reduced. */
export function AnimatedNumber({ value, decimals = 0, className }: Props) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (reduce) {
      from.current = value
      setDisplay(value)
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => {
        from.current = v
        setDisplay(v)
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span className={className}>{display.toFixed(decimals)}</span>
}
