'use client'
import { cn } from '@/lib/utils'
import { IconLayoutNavbarCollapse } from '@tabler/icons-react'
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { useRef, useState } from 'react'

export interface FloatingDockItem {
  title: string
  icon: React.ReactNode
  href: string
  isActive?: boolean
  onClick?: () => void
}

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
  orientation = 'horizontal',
}: {
  items: FloatingDockItem[]
  desktopClassName?: string
  mobileClassName?: string
  orientation?: 'horizontal' | 'vertical'
}) => {
  if (orientation === 'vertical') {
    return <FloatingDockVertical items={items} className={desktopClassName} />
  }

  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  )
}

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: FloatingDockItem[]
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('relative block md:hidden', className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: {
                    delay: idx * 0.05,
                  },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <a
                  href={item.href}
                  onClick={item.onClick}
                  key={item.title}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-900',
                    item.isActive && 'ring-2 ring-[#ccff00] text-[#ccff00]',
                  )}
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </a>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  )
}

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: FloatingDockItem[]
  className?: string
}) => {
  let mouseX = useMotionValue(Infinity)
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 md:flex dark:bg-neutral-900',
        className,
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  )
}

export const FloatingDockVertical = ({
  items,
  className,
}: {
  items: FloatingDockItem[]
  className?: string
}) => {
  let mouseY = useMotionValue(Infinity)
  return (
    <motion.div
      onMouseMove={(e) => mouseY.set(e.pageY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      className={cn('flex flex-col items-center gap-3 py-3 w-full', className)}
    >
      {items.map((item) => (
        <VerticalIconContainer mouseY={mouseY} key={item.title} {...item} />
      ))}
    </motion.div>
  )
}

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  isActive,
  onClick,
}: {
  mouseX: MotionValue
  title: string
  icon: React.ReactNode
  href: string
  isActive?: boolean
  onClick?: () => void
}) {
  let ref = useRef<HTMLDivElement>(null)

  let distance = useTransform(mouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }

    return val - bounds.x - bounds.width / 2
  })

  let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])
  let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])

  let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20])
  let heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20])

  let width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })
  let height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  let widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })
  let heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  const [hovered, setHovered] = useState(false)

  return (
    <a href={href} onClick={onClick}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'relative flex aspect-square items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800 transition-colors',
          isActive && 'bg-[#ccff00] text-black shadow-[0_0_16px_rgba(204,255,0,0.4)]',
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 2, x: '-50%' }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white pointer-events-none z-50 shadow-md"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  )
}

export function VerticalIconContainer({
  mouseY,
  title,
  icon,
  href,
  isActive,
  onClick,
}: {
  mouseY: MotionValue
  title: string
  icon: React.ReactNode
  href: string
  isActive?: boolean
  onClick?: () => void
}) {
  let ref = useRef<HTMLDivElement>(null)

  let distance = useTransform(mouseY, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 }
    return val - bounds.y - bounds.height / 2
  })

  // Smooth vertical magnification: default 44px, scaling up to 64px on hover
  let sizeTransform = useTransform(distance, [-120, 0, 120], [42, 58, 42])
  let iconSizeTransform = useTransform(distance, [-120, 0, 120], [20, 28, 20])

  let size = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 170,
    damping: 14,
  })

  let iconSize = useSpring(iconSizeTransform, {
    mass: 0.1,
    stiffness: 170,
    damping: 14,
  })

  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
      }}
      className="relative flex items-center justify-center w-full"
    >
      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'relative flex items-center justify-center rounded-2xl bg-[#161922] border border-[#202634] text-[#8e9bb2] transition-colors duration-150 hover:border-[#ccff00]/40 hover:text-[#ccff00] hover:bg-[#1a1f2c]',
          isActive &&
            'bg-[#ccff00] border-[#ccff00] text-black font-bold shadow-[0_0_20px_rgba(204,255,0,0.35)]',
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: -10, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: -6, y: '-50%' }}
              className="absolute left-full top-1/2 ml-3.5 z-50 whitespace-pre rounded-lg border border-[#202634] bg-[#111319] px-2.5 py-1 text-xs font-semibold text-white shadow-xl pointer-events-none"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: iconSize, height: iconSize }}
          className="flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  )
}

export default FloatingDock
