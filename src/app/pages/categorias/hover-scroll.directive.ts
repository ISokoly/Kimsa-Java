import { Directive, ElementRef, HostListener, AfterViewInit } from '@angular/core';

@Directive({
    selector: '[appHoverScroll]'
})
export class HoverScrollDirective implements AfterViewInit {
    private distance = 0;

    constructor(private el: ElementRef) { }

    ngAfterViewInit() {
        const containerWidth = this.el.nativeElement.parentElement.offsetWidth;
        const textWidth = this.el.nativeElement.scrollWidth;

        if (textWidth > containerWidth) {
            this.distance = textWidth - containerWidth;
        }
    }

    @HostListener('mouseenter')
    onMouseEnter() {
        if (this.distance > 0) {
            this.el.nativeElement.style.transition = `transform ${this.distance / 80}s linear`;
            this.el.nativeElement.style.transform = `translateX(-${this.distance}px)`;
        }
    }

    @HostListener('mouseleave')
    onMouseLeave() {
        if (this.distance > 0) {
            this.el.nativeElement.style.transition = `transform ${this.distance / 160}s linear`;
            this.el.nativeElement.style.transform = `translateX(0)`;
        }
    }
}
