import {
    Directive,
    ElementRef,
    HostListener
} from '@angular/core';

@Directive({
    selector: '[highlightSel]',
    standalone: true
})
export class HighlightSel {

    bgColor = '';
    color = '';

    constructor(
        public elRef: ElementRef
    ){
        // ---
    }

    @HostListener('mouseenter') onMouseEnter() {
        this.bgColor = this.elRef.nativeElement.style.backgroundColor;
        this.color = this.elRef.nativeElement.style.color;

        this.elRef.nativeElement.style.backgroundColor = 'yellow';
        this.elRef.nativeElement.style.color = 'black';
    }

    @HostListener('mouseleave') onMouseLeave() {
        this.elRef.nativeElement.style.backgroundColor = this.bgColor;
        this.elRef.nativeElement.style.color = this.color;
    }

}
