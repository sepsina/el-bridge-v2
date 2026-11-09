import {
    Component,
    OnInit,
    signal,
    inject,
    effect,
    ChangeDetectionStrategy,
    viewChild,
    ElementRef
} from '@angular/core';

import { DialogRef,
    DIALOG_DATA
} from '@angular/cdk/dialog';

import { form } from '@angular/forms/signals';

import { StorageService } from '../services/storage.service';
import { UtilsService } from '../services/utils.service';

import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';

import Chart from 'chart.js/auto';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

const NO_TIME = 'time: --:--:--';
const NO_VALUE = 'value: --.-';

// 1. Define the internal form state shape interface
interface GraphFormState {
    selIdx: number;
    selTime: string;
    selValue: string;
}

@Component({
    selector: 'app-graph',
    standalone: true,
    imports: [
        CommonModule,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './chart.html',
    styleUrls: ['./chart.scss'],
    host: {
        '[attr.id]': 'hostID',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Graph implements OnInit {

    readonly hostID = 'graph-dlg';

    readonly currentItem = signal<gIF.netItem_t>({} as gIF.netItem_t);
    readonly duration = signal<string>('');

    readonly graphFormModel = signal<GraphFormState>({
        selIdx: -1,
        selTime: NO_TIME,
        selValue: NO_VALUE
    });

    readonly graphForm = form(this.graphFormModel);

    private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
    chart!: Chart;

    readonly utils = inject(UtilsService);
    readonly storage = inject(StorageService);
    readonly dialogRef = inject(DialogRef);
    readonly dlgData = inject(DIALOG_DATA);

    constructor() {
        effect(() => {
            const items = this.storage.chartData();
            for (const item of items) {
                this.newData(item);
            }
        });
    }

    /***********************************************************************************************
     * @fn          ngOnInit
     *
     */
    ngOnInit() {
        this.currentItem.set(this.dlgData.keyVal.value);
        this.createChart();
        this.setChartData();
    }

    /***********************************************************************************************
     * @fn          resetSelection
     *
     */
    private resetSelection() {

        this.graphForm.selIdx().value.set(-1);
        this.graphForm.selTime().value.set(NO_TIME);
        this.graphForm.selValue().value.set(NO_VALUE);
    }

    /***********************************************************************************************
     * @fn          createChart
     *
     */
    createChart() {
        const canvasEl = this.canvasRef()?.nativeElement || 'canvas';

        this.chart = new Chart(canvasEl, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    fill: false,
                    borderColor: 'black',
                    pointHoverRadius: 6,
                    pointHitRadius: 20,
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    pointBackgroundColor: 'rgba(0, 0, 0, 0)',
                    pointHoverBackgroundColor: 'yellow',
                    pointHoverBorderColor: 'red'
                }]
            },
            options: {
                responsive: true,
                hover: { mode: 'nearest', intersect: true },
                scales: {
                    x: {
                        border: { color: 'lightgray' },
                        grid: { display: false },
                        ticks: { autoSkip: false, display: false }
                    },
                    y: {
                        position: 'right',
                        min: 0,
                        max: 1,
                        border: { dash: [8, 4], color: 'lightgray' },
                        grid: { color: 'lightgray', display: true },
                        ticks: { stepSize: 1 }
                    }
                },
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true, displayColors: false }
                },
                onClick: (event, elements, chart) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;

                        // Mutate your Form Signals safely on item selection
                        this.graphForm.selIdx().value.set(idx);

                        const time = chart.data.labels![idx];
                        const value: any = chart.data.datasets[0].data[idx];

                        this.graphForm.selTime().value.set(`time: ${time}`);
                        this.graphForm.selValue().value.set(`value: ${value.toFixed(1)}`);
                    } else {
                        this.resetSelection();
                    }
                }
            }
        });
    }

    /***********************************************************************************************
     * @fn          setChartData
     *
     */
    setChartData() {

        const item = this.currentItem();
        this.chart.data.labels = [];
        this.chart.data.datasets[0].data = [];

        const len = item.timestamps?.length || 0;
        if(len === 0) {
            this.duration.set(this.utils.secToTime(0));
            this.chart.update('none');
            return;
        }

        const end = item.timestamps[len - 1];
        let minVal = 1e6;
        let maxVal = -1e6;
        const offset = item.valCorr.offset;

        for(let i = 0; i < len; i++) {
            let corrVal = item.vals[i] + offset;
            switch(item.group) {
                case gIF.eGroup_t.E_GROUP_TEMPERATURE: {
                    if(item.valCorr.units === gConst.DEG_F) {
                        corrVal = (corrVal * 9.0) / 5.0 + 32.0;
                    }
                    break;
                }
            }
            this.chart.data.datasets[0].data[i] = corrVal;
            this.chart.data.labels[i] = this.utils.secToTime(end - item.timestamps[i]);

            if(corrVal > maxVal) maxVal = corrVal;
            if(corrVal < minVal) minVal = corrVal;
        }

        const timeSpan = item.timestamps[len - 1] - item.timestamps[0];
        this.duration.set(`${this.utils.secToTime(timeSpan)}`);

        let step = 1;
        let max = Math.ceil(maxVal);
        if((max - maxVal) < 0.1) max++;
        let min = max;
        while(min >= minVal) min--;

        if(maxVal > minVal) {
            step = Math.ceil((maxVal - minVal) / 4);
            max = Math.ceil(maxVal);
            if((max - maxVal) < 0.1) max += step;
            min = max;
            while(min >= minVal) min -= step;
        }

        const yAxis = this.chart.options.scales!['y'] as any;

        if(yAxis) {
            yAxis.max = max;
            yAxis.min = min;

            if(!yAxis.ticks) {
                yAxis.ticks = {};
            }
            yAxis.ticks.stepSize = step;
        }

        this.configureTooltips(item);
        this.chart.update('none');
    }

    /***********************************************************************************************
     * @fn          configureTooltips
     *
     */
    private configureTooltips(item: gIF.netItem_t) {

        const dataset = this.chart.data.datasets[0] as any;

        switch(item.group) {
            case gIF.eGroup_t.E_GROUP_TEMPERATURE: {
                dataset.tension = 0.2;
                dataset.borderColor = 'red';
                const unit = item.valCorr.units === gConst.DEG_F ? 'degF' : 'degC';

                this.chart.options.plugins!.tooltip!.callbacks = {
                    title: (items: any) => items.label,
                    label: (item: any) => `${item.raw.toFixed(1)} ${unit}`
                };
                break;
            }
            case gIF.eGroup_t.E_GROUP_HUMIDITY: {
                dataset.tension = 0.2;
                dataset.borderColor = 'green';

                this.chart.options.plugins!.tooltip!.callbacks = {
                    title: (items: any) => items[0].label,
                    label: (item: any) => `${item.raw.toFixed(0)} %rh`
                };
                break;
            }
            case gIF.eGroup_t.E_GROUP_AIR_QUALITY: {
                const yAxis = this.chart.options.scales!['y'] as any;
                if (yAxis) {
                    yAxis.max = 5;
                    yAxis.min = 1;
                    if (!yAxis.ticks) yAxis.ticks = {};
                    yAxis.ticks.stepSize = 1;
                }

                dataset.borderColor = 'green';
                this.chart.options.plugins!.tooltip!.callbacks = {
                    title: (items: any) => items.label,
                    label: (item: any) => `aq - ${item.raw.toFixed(0)}`
                };
                break;
            }
            case gIF.eGroup_t.E_GROUP_ON_OFF: {
                const yAxis = this.chart.options.scales!['y'] as any;
                if (yAxis) {
                    yAxis.max = 1;
                    yAxis.min = 0;
                    if (!yAxis.ticks) yAxis.ticks = {};
                    yAxis.ticks.stepSize = 1;
                }

                dataset.borderColor = 'black';
                this.chart.options.plugins!.tooltip!.callbacks = {
                    title: (items: any) => items.label,
                    label: (item: any) => item.raw === 1 ? 'on' : 'off'
                };
                break;
            }
        }
    }

    /***********************************************************************************************
     * @fn          close
     *
     */
    close() {
        this.dialogRef.close();
    }

    /***********************************************************************************************
     * @fn          delSelPoint
     *
     */
    delSelPoint() {
        const idx = this.graphForm.selIdx().value();
        if (idx < 0) return;

        const item = this.currentItem();
        item.vals.splice(idx, 1);
        item.timestamps.splice(idx, 1);

        this.resetSelection();
        this.setChartData();
    }

    /***********************************************************************************************
     * @fn          newData
     *
     */
    newData(item: gIF.netItem_t) {
        const current = this.currentItem();
        if (item.addr === current.addr &&
            item.endPoint === current.endPoint &&
            item.group === current.group &&
            item.type === current.type) {

            this.resetSelection();
            this.setChartData();
        }
    }
}
