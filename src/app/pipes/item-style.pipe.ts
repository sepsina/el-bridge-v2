import { Pipe, PipeTransform, inject } from '@angular/core';
import { UtilsService } from '../services/utils.service'; // Adjust path to your utils location

interface StyleItem {
  isValid: boolean;
  style: {
    color: string;
    bgColor: string;
    bgOpacity: number;
    fontSize: number;
    borderColor: string;
    borderWidth: number;
    borderStyle: string;
    borderRadius: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
}

@Pipe({
  name: 'itemStyle',
  standalone: true // Safe for modern Angular
})
export class ItemStylePipe implements PipeTransform {

  private utils = inject(UtilsService);

  transform(item: StyleItem): Record<string, string | number> {
    if (!item.isValid) {
      return {
        'color': 'gray',
        'background-color': 'transparent',
        'border-color': 'gray',
        'border-width': '2px',
        'border-style': 'dotted'
      };
    }

    const {
      color, bgColor, bgOpacity, fontSize, borderColor,
      borderWidth, borderStyle, borderRadius,
      paddingTop, paddingRight, paddingBottom, paddingLeft
    } = item.style;

    return {
      'color': color,
      'background-color': this.utils.hexToRGB(bgColor, bgOpacity),
      'font-size': `${fontSize}px`,
      'border-color': borderColor,
      'border-width': `${borderWidth}px`,
      'border-style': borderStyle,
      'border-radius': `${borderRadius}px`,
      'padding': `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`
    };
  }
}
