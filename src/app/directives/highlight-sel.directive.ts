import {
    Directive,
    ElementRef,
    HostListener,
    Input,
    Renderer2,
    inject
} from '@angular/core';

@Directive({
    selector: '[highlightSel]',
    standalone: true
})
export class HighlightSel {

    @Input() highlightBgColor = 'yellow';
    @Input() highlightColor = 'black';

    private readonly el = inject(ElementRef<HTMLElement>);
    private readonly renderer = inject(Renderer2);

    private originalBgColor = '';
    private originalColor = '';

    @HostListener('mouseenter')
    onMouseEnter(): void {
        const style = this.el.nativeElement.style;
        this.originalBgColor = style.backgroundColor;
        this.originalColor = style.color;

        this.renderer.setStyle(this.el.nativeElement, 'background-color', this.highlightBgColor);
        this.renderer.setStyle(this.el.nativeElement, 'color', this.highlightColor);
    }

    @HostListener('mouseleave')
    onMouseLeave(): void {
        this.renderer.setStyle(this.el.nativeElement, 'background-color', this.originalBgColor);
        this.renderer.setStyle(this.el.nativeElement, 'color', this.originalColor);
    }

}
