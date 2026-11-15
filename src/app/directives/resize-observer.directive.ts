import {
    Directive,
    ElementRef,
    DestroyRef,
    output,
    inject
} from '@angular/core';

@Directive({
    selector: '[resizeObserver]',
    standalone: true,
})
export class ResizeObserverDirective {

    resize = output<ResizeObserverEntry>();

    private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);

    private observer: ResizeObserver | null = null;
    private frameId: number | null = null;
    private latestEntry: ResizeObserverEntry | null = null;

    constructor() {
        this.observer = new ResizeObserver((entries) => {
            this.latestEntry = entries[entries.length - 1] ?? null;

            if(this.frameId !== null) {
                return;
            }

            this.frameId = requestAnimationFrame(() => {
                this.frameId = null;
                const entry = this.latestEntry;
                this.latestEntry = null;
                if(entry) {
                    this.resize.emit(entry);
                }
            });
        });

        this.observer.observe(this.el.nativeElement);

        this.destroyRef.onDestroy(() => {
            if(this.frameId !== null) {
                cancelAnimationFrame(this.frameId);
                this.frameId = null;
            }
            this.observer?.disconnect();
            this.observer = null;
            this.latestEntry = null;
        });
    }
}
