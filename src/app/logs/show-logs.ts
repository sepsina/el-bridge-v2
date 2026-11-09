import {
    Component,
    ElementRef,
    AfterViewInit,
    viewChild,
    inject,
    effect,
    ChangeDetectionStrategy
} from '@angular/core';

import { DialogRef } from '@angular/cdk/dialog';

import { UtilsService } from '../services/utils.service';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF'

@Component({
    selector: 'app-show-logs',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './show-logs.html',
    styleUrls: ['./show-logs.scss'],
    host: {
        '[attr.id]': 'hostID',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowLogs implements AfterViewInit{

    hostID = 'logs-dlg';

    cbScroll = viewChild.required('cbScroll', {read: ElementRef});
    logList = viewChild.required('logList', {read: ElementRef});

    utils = inject(UtilsService);
    dialogRef = inject(DialogRef);

    new_log = effect(()=>{
        const logs = this.utils.msgLogs();
        if(this.cbScroll().nativeElement.checked) {
            this.logList().nativeElement.scrollTop = this.logList().nativeElement.scrollHeight;
        }
    });

    constructor() {
        // ---
    }

    /***********************************************************************************************
     * @fn          afterViewInit
     *
     * @brief
     *
     */
    ngAfterViewInit(): void {
        this.cbScroll().nativeElement.checked = false;
    }

    /***********************************************************************************************
     * @fn          close
     *
     * @brief
     *
     */
    close() {
        this.dialogRef.close();
    }

    /***********************************************************************************************
     * fn          autoScroll
     *
     * brief
     *
     */
    autoScrollChange() {
        if(this.cbScroll().nativeElement.checked) {
            this.logList().nativeElement.scrollTop = this.logList().nativeElement.scrollHeight;
        }
    }

    /***********************************************************************************************
     * fn          clearLogs
     *
     * brief
     *
     */
    clearLogs() {
        this.utils.msgLogs.set([]);
    }

}
