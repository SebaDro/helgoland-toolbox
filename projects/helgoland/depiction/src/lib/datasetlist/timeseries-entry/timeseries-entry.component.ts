import {
    Component,
    EventEmitter,
    Injectable,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    ViewEncapsulation,
} from '@angular/core';
import {
    ColorService,
    Dataset,
    DatasetApiInterface,
    DatasetOptions,
    FirstLastValue,
    IDataset,
    IdCache,
    InternalIdHandler,
    ReferenceValue,
    Time,
    TimeInterval,
    Timeseries,
    ParameterFilter,
} from '@helgoland/core';

import { HighlightableEntry, ListEntryComponent } from '../list-entry.component';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class ReferenceValueColorCache extends IdCache<{ color: string, visible: boolean }> { }

@Component({
    selector: 'n52-timeseries-entry',
    templateUrl: './timeseries-entry.component.html',
    styleUrls: ['./timeseries-entry.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class TimeseriesEntryComponent extends ListEntryComponent implements OnChanges, HighlightableEntry {

    @Input()
    public datasetOptions: DatasetOptions;

    @Input()
    public timeInterval: TimeInterval;

    @Input()
    public changedSelectedDatasets: string;

    @Input()
    public highlight: boolean;

    @Output()
    public onUpdateOptions: EventEmitter<DatasetOptions> = new EventEmitter();

    @Output()
    public onEditOptions: EventEmitter<DatasetOptions> = new EventEmitter();

    @Output()
    public onSelectDate: EventEmitter<Date> = new EventEmitter();

    @Output()
    public onShowGeometry: EventEmitter<GeoJSON.GeoJsonObject> = new EventEmitter();

    public platformLabel: string;
    public phenomenonLabel: string;
    public procedureLabel: string;
    public categoryLabel: string;
    public uom: string;
    public firstValue: FirstLastValue;
    public lastValue: FirstLastValue;
    public informationVisible = false;
    public tempColor: string;
    public hasData = true;
    public referenceValues: ReferenceValue[];
    public loading: boolean;

    public dataset: IDataset;

    constructor(
        protected api: DatasetApiInterface,
        protected timeSrvc: Time,
        protected internalIdHandler: InternalIdHandler,
        protected color: ColorService,
        protected refValCache: ReferenceValueColorCache,
        protected translateSrvc: TranslateService
    ) {
        super(internalIdHandler, translateSrvc);
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.changedSelectedDatasets) {
            if (changes.changedSelectedDatasets.firstChange !== true) {
                changes.changedSelectedDatasets.currentValue.forEach((obj) => {
                    this.toggleUomSelection(obj.id, obj.change);
                });
            }
        }

        if (changes.timeInterval) {
            this.checkDataInTimespan();
        }
    }

    public toggleUomSelection(id, selected) {
        if (this.datasetId === id) {
            this.selected = selected;
            this.onSelectDataset.emit(this.selected);
        }
    }

    public toggleInformation() {
        this.informationVisible = !this.informationVisible;
    }

    public jumpToFirstTimeStamp() {
        this.onSelectDate.emit(new Date(this.dataset.firstValue.timestamp));
    }

    public jumpToLastTimeStamp() {
        this.onSelectDate.emit(new Date(this.dataset.lastValue.timestamp));
    }

    public toggleVisibility() {
        this.datasetOptions.visible = !this.datasetOptions.visible;
        this.onUpdateOptions.emit(this.datasetOptions);
    }

    public toggleReferenceValue(refValue: ReferenceValue) {
        const idx = this.datasetOptions.showReferenceValues.findIndex((entry) => entry.id === refValue.referenceValueId);
        const refValId = this.createRefValId(refValue.referenceValueId);
        if (idx > -1) {
            refValue.visible = false;
            this.datasetOptions.showReferenceValues.splice(idx, 1);
        } else {
            refValue.visible = true;
            this.datasetOptions.showReferenceValues.push({ id: refValue.referenceValueId, color: refValue.color });
        }
        this.refValCache.get(refValId).visible = refValue.visible;
        this.onUpdateOptions.emit(this.datasetOptions);
    }

    public editDatasetOptions() {
        this.onEditOptions.emit(this.datasetOptions);
    }

    public showGeometry() {
        if (this.dataset instanceof Timeseries) {
            this.onShowGeometry.emit(this.dataset.station.geometry);
        }
        if (this.dataset instanceof Dataset) {
            this.api.getPlatform(this.dataset.parameters.platform.id, this.dataset.url).subscribe((platform) => {
                this.onShowGeometry.emit(platform.geometry);
            });
        }
    }

    protected loadDataset(lang?: string) {
        const params: ParameterFilter = {};
        if (lang) { params.lang = lang; }
        this.loading = true;
        this.api.getSingleTimeseries(this.internalId.id, this.internalId.url, params).subscribe((timeseries) => {
            this.dataset = timeseries;
            this.setParameters();
            this.loading = false;
        }, (error) => {
            this.api.getDataset(this.internalId.id, this.internalId.url, params).subscribe((dataset) => {
                this.dataset = dataset;
                this.setParameters();
                this.loading = false;
            });
        });
    }

    private setParameters() {
        if (this.dataset instanceof Dataset) {
            this.platformLabel = this.dataset.parameters.platform.label;
        } else if (this.dataset instanceof Timeseries) {
            this.platformLabel = this.dataset.station.properties.label;
        }
        this.phenomenonLabel = this.dataset.parameters.phenomenon.label;
        this.procedureLabel = this.dataset.parameters.procedure.label;
        this.categoryLabel = this.dataset.parameters.category.label;
        this.firstValue = this.dataset.firstValue;
        this.lastValue = this.dataset.lastValue;
        this.uom = this.dataset.uom;
        if (this.dataset.referenceValues) {
            this.dataset.referenceValues.forEach((e) => {
                const refValId = this.createRefValId(e.referenceValueId);
                const refValOption = this.datasetOptions.showReferenceValues.find((o) => o.id === e.referenceValueId);
                if (refValOption) {
                    this.refValCache.set(refValId, {
                        color: refValOption.color,
                        visible: true
                    });
                }
                if (!this.refValCache.has(refValId)) {
                    this.refValCache.set(refValId, {
                        color: this.color.getColor(),
                        visible: false
                    });
                }
                e.color = this.refValCache.get(refValId).color;
                e.visible = this.refValCache.get(refValId).visible;
            });
        }
        this.checkDataInTimespan();
    }

    private createRefValId(refId: string) {
        return this.dataset.url + refId;
    }

    private checkDataInTimespan() {
        if (this.timeInterval && this.dataset) {
            this.hasData = this.timeSrvc.overlaps(
                this.timeInterval,
                this.dataset.firstValue.timestamp,
                this.dataset.lastValue.timestamp
            );
        }
    }
}
