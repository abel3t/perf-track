import { useMediaQuery } from '#/hooks/use-media-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '#/components/ui/sheet'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function ResponsiveModal({ open, onClose, title, children, footer }: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] p-0 gap-0">
          {/* Fixed header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--line)] shrink-0">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {children}
          </div>

          {/* Fixed footer */}
          {footer && (
            <div className="shrink-0 px-6 py-4 border-t border-[var(--line)] bg-[var(--surface)]">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-2xl flex flex-col p-0 gap-0"
      >
        {/* Fixed header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0">
          {children}
        </div>

        {/* Fixed footer */}
        {footer && (
          <div
            className="shrink-0 px-5 py-4 border-t border-[var(--line)] bg-[var(--surface)]"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
