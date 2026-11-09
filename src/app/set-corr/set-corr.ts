import {
    Component,
    ElementRef,
    OnInit,
    viewChild,
    inject,
    signal,
    computed,
    effect,
    ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog'; // Inject standard tokens
import { StorageService } from '../services/storage.service';
import {
    form,
    FormField,
    debounce,
    required,
    min,
    max
} from '@angular/forms/signals';
import * as gConst from '../gConst';
import * as gIF from '../gIF';

interface CorrFormModel {
    offset: number;
    unitIdx: string;
}

@Component({
    selector: 'app-set-corr',
    standalone: true,
    imports: [
        CommonModule,
        FormField,
        CdkDrag,
        CdkDragHandle],
    templateUrl: './set-corr.html',
    styleUrls: ['./set-corr.scss'],
    host: { '[attr.id]': 'hostID' },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetCorr implements OnInit {

    private storage = inject(StorageService);
    private dialogRef = inject(DialogRef);
    private dlgData = inject<any>(DIALOG_DATA); // Injecting the incoming payload object

    offsetRef = viewChild.required<ElementRef>('offset');

    hostID = 'corr-dlg';
    keyVal!: gIF.keyVal_t;
    valCorr!: gIF.valCorr_t;
    title = signal('');
    allUnits = signal<gIF.units_t[]>([]);

    private prevIdx = 0;

    formModel = signal<CorrFormModel>({ offset: 0, unitIdx: '0' });

    protected corrForm = form(this.formModel, (path) => {
        debounce(path.offset, 'blur');
        required(path.offset, { message: 'An offset correction must be entered.' });
        min(path.offset, -50, { message: 'Offset bounds exceeded (-50 minimum).' });
        max(path.offset, 50, { message: 'Offset bounds exceeded (50 maximum).' });
    });

    currentUnit = computed(() => {
        const units = this.allUnits();
        const index = parseInt(this.formModel().unitIdx, 10);
        return units[index] || null;
    });

    constructor() {
        effect(() => {
            const inputEl = this.offsetRef();
            if(inputEl?.nativeElement) {
                inputEl.nativeElement.focus();
                inputEl.nativeElement.select();
            }
        });
    }

    ngOnInit(): void {

        // Read directly from the DIALOG_DATA token
        this.keyVal = this.dlgData.keyVal;
        const targetItem = this.keyVal.value;

        this.valCorr = { ...targetItem.valCorr };
        this.title.set(targetItem.name);

        let initialOffset = this.valCorr.offset;
        let initialUnitIdx = '0';

        switch (targetItem.group) {
            case gIF.eGroup_t.E_GROUP_TEMPERATURE: {
                this.allUnits.set([
                    { name: 'degC', units: gConst.DEG_C },
                    { name: 'degF', units: gConst.DEG_F }
                ]);

                if (targetItem.valCorr.units === gConst.DEG_F) {
                    this.prevIdx = 1;
                    initialUnitIdx = '1';
                    initialOffset = (initialOffset * 9.0) / 5.0;
                    initialOffset = Math.round(initialOffset * 10) / 10;
                }
                break;
            }
            case gIF.eGroup_t.E_GROUP_HUMIDITY: {
                this.allUnits.set([{ name: '%', units: gConst.RH_UNIT }]);
                break;
            }
        }

        this.formModel.set({
            offset: initialOffset,
            unitIdx: initialUnitIdx
        });
    }

    unitSelect(idx: string) {

        const nextIdx = parseInt(idx, 10);
        const nextUnit = this.allUnits()[nextIdx];
        const prevUnit = this.allUnits()[this.prevIdx];
        this.prevIdx = nextIdx;

        const rawInputVal = this.offsetRef().nativeElement.value;
        let currentVal = parseFloat(rawInputVal);

        if(Number.isNaN(currentVal)) {
            currentVal = this.formModel().offset;
        }

        if(nextUnit.units === gConst.DEG_F && prevUnit.units === gConst.DEG_C) {
            currentVal = (currentVal * 9.0) / 5.0;
            currentVal = Math.round(currentVal * 10) / 10;
        }
        else if (nextUnit.units === gConst.DEG_C && prevUnit.units === gConst.DEG_F) {
            currentVal = (currentVal * 5.0) / 9.0;
            currentVal = Math.round(currentVal * 10) / 10;
        }

        this.formModel.set({
            offset: currentVal,
            unitIdx: idx
        });
    }

    async save() {

        if (this.corrForm().invalid()) return;

        let finalOffset = this.formModel().offset;
        const activeUnit = this.currentUnit();

        if (activeUnit && activeUnit.units === gConst.DEG_F) {
            finalOffset = (finalOffset * 5.0) / 9.0;
            finalOffset = Math.round(finalOffset * 10) / 10;
        }

        this.valCorr.units = activeUnit ? activeUnit.units : this.valCorr.units;
        this.valCorr.offset = finalOffset;

        // Pass data directly into the closing function parameter slot
        this.dialogRef.close({ ...this.valCorr });
    }

    close() {
        this.dialogRef.close();
    }
}

