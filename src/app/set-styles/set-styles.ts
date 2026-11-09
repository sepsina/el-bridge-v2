import {
    Component,
    ElementRef,
    AfterViewInit,
    viewChild,
    inject,
    signal,
    effect
} from '@angular/core';

import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { StorageService } from '../services/storage.service';
import { UtilsService } from '../services/utils.service';

import { CommonModule } from '@angular/common';
import { form, FormField, debounce, min, max, required } from '@angular/forms/signals';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

@Component({
    selector: 'app-set-styles',
    standalone: true,
    imports: [
        CommonModule,
        FormField,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './set-styles.html',
    styleUrls: ['./set-styles.scss'],
    host: {
        '[attr.id]': 'hostID'
    }
})
export class SetStyles implements AfterViewInit {

    hostID = 'styles-dlg';

    testView = viewChild.required('testView', { read: ElementRef });
    fontSizeRef = viewChild.required('itemFontSize', { read: ElementRef });

    dlg_title = signal('');
    test_el = {} as HTMLElement;
    test_text = signal('');

    borderStyles = gConst.BORDER_STYLES;
    style = {} as gIF.ngStyle_t;

    styleModel = signal<gIF.ngStyle_t>({} as gIF.ngStyle_t);

    styleForm = form(this.styleModel, (schema) => {
        debounce(schema.fontSize, 'blur');
        debounce(schema.borderWidth, 'blur');
        debounce(schema.borderRadius, 'blur');
        debounce(schema.paddingTop, 'blur');
        debounce(schema.paddingLeft, 'blur');
        debounce(schema.paddingRight, 'blur');
        debounce(schema.paddingBottom, 'blur');

        required(schema.fontSize);
        min(schema.fontSize, 4);
        required(schema.borderWidth);
        min(schema.borderWidth, 0);
        required(schema.borderRadius);
        min(schema.borderRadius, 0);
        required(schema.paddingTop);
        min(schema.paddingTop, 0);
        required(schema.paddingLeft);
        min(schema.paddingLeft, 0);
        required(schema.paddingRight);
        min(schema.paddingRight, 0);
        required(schema.paddingBottom);
        min(schema.paddingBottom, 0);

        min(schema.bgOpacity, 0);
        max(schema.bgOpacity, 1);
    });

    storage = inject(StorageService);
    utils = inject(UtilsService);
    dialogRef = inject(DialogRef);
    dlgData = inject(DIALOG_DATA);

    selItem = {} as gIF.netItem_t;

    constructor() {
        this.selItem = this.dlgData.keyVal.value;
        this.styleModel.set({...this.selItem.style});

        effect(() => {
            if(this.styleForm().invalid()) {
                console.log('Form is invalid, skipping style update...');
                return;
            }

            const ngStyle = this.styleForm().value();

            if(this.test_el && this.test_el.style) {
                this.test_el.style.color = ngStyle.color;
                this.test_el.style.borderColor = ngStyle.borderColor;
                this.test_el.style.borderStyle = ngStyle.borderStyle;

                const rgba = this.utils.hexToRGB(ngStyle.bgColor, ngStyle.bgOpacity);
                this.test_el.style.backgroundColor = rgba;

                this.test_el.style.fontSize = `${ngStyle.fontSize}px`;
                this.test_el.style.borderWidth = `${ngStyle.borderWidth}px`;
                this.test_el.style.borderRadius = `${ngStyle.borderRadius}px`;
                this.test_el.style.paddingTop = `${ngStyle.paddingTop}px`;
                this.test_el.style.paddingRight = `${ngStyle.paddingRight}px`;
                this.test_el.style.paddingBottom = `${ngStyle.paddingBottom}px`;
                this.test_el.style.paddingLeft = `${ngStyle.paddingLeft}px`;
            }
        });
    }

    ngAfterViewInit(): void {

        this.test_text.set(this.selItem.formatedVal);
        this.dlg_title.set(this.selItem.name);

        this.test_el = this.testView().nativeElement;
        const ngStyle = this.styleForm().value();

        this.test_el.style.color = ngStyle.color;
        const rgba = this.utils.hexToRGB(ngStyle.bgColor, ngStyle.bgOpacity);
        this.test_el.style.backgroundColor = rgba;
        this.test_el.style.fontSize = `${ngStyle.fontSize}px`;

        this.test_el.style.borderColor = ngStyle.borderColor;
        this.test_el.style.borderWidth = `${ngStyle.borderWidth}px`;
        this.test_el.style.borderStyle = ngStyle.borderStyle;
        this.test_el.style.borderRadius = `${ngStyle.borderRadius}px`;

        this.test_el.style.paddingTop = `${ngStyle.paddingTop}px`;
        this.test_el.style.paddingRight = `${ngStyle.paddingRight}px`;
        this.test_el.style.paddingBottom = `${ngStyle.paddingBottom}px`;
        this.test_el.style.paddingLeft = `${ngStyle.paddingLeft}px`;

        this.fontSizeRef().nativeElement.focus();
        this.fontSizeRef().nativeElement.select();
    }

    save() {
        // check if the form is valid before saving
        if(this.styleForm().invalid()) {
            console.log('Form is invalid, cannot save style configuration.');
            return;
        }
        this.dialogRef.close({...this.styleForm().value()});
    }

    close() {
        this.dialogRef.close();
    }
}
