import {
    Component,
    ElementRef,
    viewChild,
    inject,
    signal,
    ChangeDetectionStrategy,
    OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
    form,
    FormField,
    minLength,
    maxLength,
    required,
    debounce
} from '@angular/forms/signals';

import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop';

import { StorageService } from '../services/storage.service';

import * as gConst from '../gConst';
import * as gIF from '../gIF'

interface NameFormModel {
    name: string;
}

@Component({
    selector: 'app-name',
    standalone: true,
    imports: [
        CommonModule,
        FormField,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './set-name.html',
    styleUrls: ['./set-name.scss'],
    host: {
        '[attr.id]': 'hostID'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetName implements OnInit {

    readonly hostID = 'name-dlg';
    itemNameRef = viewChild.required('itemName', {read: ElementRef});

    private readonly storage = inject(StorageService);
    private readonly dialogRef = inject(DialogRef);
    private readonly dlgData = inject(DIALOG_DATA);

    // Context Cache
    private selItem = {} as gIF.keyVal_t;

    // View-bound non-form signals
    readonly title = signal('');

    // 1. Define the source-of-truth model signal
    private readonly formModel = signal<NameFormModel>({ name: '' });

    // 2. Build the structural type-safe FieldTree with blur-based debouncing
    protected readonly nameForm = form(this.formModel, (path) => {
        // Intercepts input mutations; delays updates to formModel until the input blurs
        debounce(path.name, 'blur');
        required(path.name, { message: 'name is required.' });
        minLength(path.name, 2, { message: 'to short' });
        maxLength(path.name, 16, { message: 'to long' });
    });

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

        this.selItem = this.dlgData.keyVal;
        const initialName = this.selItem.value.name || '';

        this.title.set(initialName);

        // Seeding the model signal syncs the initialized values down the field tree
        this.formModel.set({ name: initialName });

        // Auto-focus and text selection on modal open
        setTimeout(() => {
            const inputEl = this.itemNameRef().nativeElement;
            inputEl.focus();
            inputEl.select();
        }, 0);
    }

    /***********************************************************************************************
     * @fn          save
     *
     * @brief
     *
     */
    save(): void {
        if (this.nameForm().invalid()) {
            return;
        }
        this.dialogRef.close(this.formModel().name);
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
