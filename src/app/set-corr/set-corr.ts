import {
    Component,
    OnInit,
    inject,
    signal,
    computed,
    ChangeDetectionStrategy
} from '@angular/core';

import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { form, FormField } from '@angular/forms/signals';

import { StorageService } from '../services/storage.service';
import * as gConst from '../gConst';
import * as gIF from '../gIF';

interface CorrDialogData {
  keyVal: gIF.keyVal_t;
}
interface CorrFormModel {
  units: string;
}

@Component({
    selector: 'app-set-corr',
    standalone: true,
    imports: [
        CdkDrag,
        CdkDragHandle,
        FormField
    ],
    templateUrl: './set-corr.html',
    styleUrls: ['./set-corr.scss'],
    host: { '[attr.id]': 'hostID' },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetCorr implements OnInit {

    private storage = inject(StorageService);
    private dialogRef = inject(DialogRef);
    private dlgData = inject<CorrDialogData>(DIALOG_DATA);

    readonly hostID = 'corr-dlg';

    private keyVal!: gIF.keyVal_t;
    private valCorr!: gIF.valCorr_t;

    readonly title = signal('');
    readonly allUnits = signal<gIF.units_t[]>([]);
    readonly formModel = signal<CorrFormModel>({ units: String(gConst.NO_UNIT) });

    protected readonly corrForm = form(this.formModel);

    readonly currentUnit = computed<gIF.units_t | null>(() => {
        const units = Number(this.formModel().units);
        return this.allUnits().find(u => u.units === units) ?? null;
    });

    ngOnInit(): void {

        this.keyVal = this.dlgData.keyVal;
        const targetItem = this.keyVal.value;
        const nvProps = this.storage.nvPropsMap.get(this.keyVal.key);

        this.valCorr = {
            ...(nvProps?.valCorr ?? { units: gConst.NO_UNIT, offset: 0 })
        };
        this.title.set(targetItem.name);

        if(targetItem.group === gIF.eGroup_t.E_GROUP_TEMPERATURE) {
            this.allUnits.set([
                { name: 'degC', units: gConst.DEG_C },
                { name: 'degF', units: gConst.DEG_F }
            ]);
        }

        const saved = Number(this.valCorr.units);
        const match = this.allUnits().find(u => u.units === saved);
        const initialUnit = match ? match.units : (this.allUnits()[0]?.units ?? gConst.NO_UNIT);

        this.formModel.set({
            units: String(initialUnit)
        });
    }

    async save() {

        if(this.corrForm().invalid()) return;


        const activeUnit = this.currentUnit();
        this.valCorr.units = activeUnit ? activeUnit.units : this.valCorr.units;

        const formatted = this.formatValue(this.keyVal.value.vals.at(-1), this.valCorr.units);
        const item = this.storage.itemMap().get(this.keyVal.key);
        if(item && formatted) {
            item.formatedVal = formatted;
        }

        this.dialogRef.close({ ...this.valCorr });
    }

    close() {
        this.dialogRef.close();
    }

    private formatValue(valC: number | undefined, units: number): string | null {
        if(valC === undefined) return null;
        switch(units) {
            case gConst.DEG_F: return `${(valC * 9 / 5 + 32).toFixed(1)} °F`;
            case gConst.DEG_C: return `${valC.toFixed(1)} °C`;
            default: return null;
        }
    }
}

