import {
    Component,
    OnInit,
    HostBinding,
    inject,
    signal,
    ChangeDetectionStrategy
} from '@angular/core';

import {
    DialogRef,
    DIALOG_DATA
} from '@angular/cdk/dialog';

import { UtilsService } from '../services/utils.service';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF'

@Component({
    selector: 'app-about',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './about.html',
    styleUrls: ['./about.scss'],
    host: {
        '[attr.id]': 'hostID',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About implements OnInit {

    hostID = 'about-dlg';

    recs = signal<string[]>([]);
    title = signal('');

    utils = inject(UtilsService);
    dialogRef = inject(DialogRef);
    dlgData = inject(DIALOG_DATA);

    constructor() {
        // ---
    }

    /***********************************************************************************************
     * @fn          ngOnInit
     *
     * @brief
     *
     */
    ngOnInit(): void {
        const item = <gIF.netItem_t>this.dlgData.item;
        this.title.set(item.name);
        let partDesc: gIF.part_t = this.dlgData.partsMap.get(item.partNum);
        if(partDesc) {
            const tmp = [];
            tmp.push(`node: ${partDesc.devName}`);
            tmp.push(`part: ${partDesc.part}`);
            //tmp.push(`S/N: ${this.utils.extToHex(attr.extAddr)}`);
            tmp.push(`url: ${partDesc.url}`);
            this.recs.set(tmp);
        }
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

}
