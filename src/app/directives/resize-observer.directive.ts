import {
    Directive,
    ElementRef,
    OnDestroy,
    NgZone,
    output,
    inject
} from '@angular/core';

@Directive({
    selector: '[resizeObserver]',
    standalone: true,
})
export class ResizeObserverDirective implements OnDestroy {
    resize = output<ResizeObserverEntry>();

    private el = inject(ElementRef);
    private ngZone = inject(NgZone);
    private observer?: ResizeObserver;
    private timeoutId: any = null;

    constructor() {
        this.observer = new ResizeObserver((entries) => {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        // Track window resizing silently in the background
        this.timeoutId = setTimeout(() => {
            this.timeoutId = null;

            // Re-enter Angular's change detection zone only on the final debounced emit
            this.ngZone.run(() => {
            if (entries.length > 0) {
                this.resize.emit(entries[0]);
            }
            });
        }, 200);
        });

        this.observer.observe(this.el.nativeElement);
    }

    ngOnDestroy() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.observer?.disconnect();
    }
}
