import { Pipe, PipeTransform } from '@angular/core';

interface PositionItem {
    drag: boolean;
    pos: { x: number; y: number };
}

interface ImageDimensions {
    width: number;
    height: number;
}

@Pipe({
    name: 'itemPosition',
    standalone: true
})
export class ItemPositionPipe implements PipeTransform {

    transform(item: PositionItem, imgDim: ImageDimensions): { x: number; y: number } | undefined {

        if(item.drag) {
            return undefined;
        }
        return {
            x: item.pos.x * imgDim.width,
            y: item.pos.y * imgDim.height
        };
    }
}
