import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DatasetApiInterface, Station, Timeseries } from '@helgoland/core';

export class ExtendedTimeseries extends Timeseries {
    public selected: boolean;
}

@Component({
    selector: 'n52-dataset-by-station-selector',
    templateUrl: './dataset-by-station-selector.component.html',
    styleUrls: ['./dataset-by-station-selector.component.scss']
})
export class DatasetByStationSelectorComponent implements OnInit {

    @Input()
    public station: Station;

    @Input()
    public url: string;

    @Input()
    public defaultSelected = false;

    @Input()
    public phenomenonId: string;

    @Output()
    public onSelectionChanged: EventEmitter<Timeseries[]> = new EventEmitter<Timeseries[]>();

    public timeseriesList: ExtendedTimeseries[] = [];

    public counter: number;

    constructor(
        protected apiInterface: DatasetApiInterface
    ) { }

    public ngOnInit() {
        if (this.station) {
            const stationId = this.station.properties && this.station.properties.id ? this.station.properties.id : this.station.id;
            this.apiInterface.getStation(stationId, this.url)
                .subscribe((station) => {
                    this.station = station;
                    this.counter = 0;
                    for (const id in this.station.properties.timeseries) {
                        if (this.station.properties.timeseries.hasOwnProperty(id)) {
                            this.counter++;
                            this.apiInterface.getSingleTimeseries(id, this.url)
                                .subscribe((result) => {
                                    this.prepareResult(result as ExtendedTimeseries, this.defaultSelected);
                                    this.counter--;
                                }, (error) => {
                                    this.counter--;
                                });
                        }
                    }
                });
        }
    }

    public toggle(timeseries: ExtendedTimeseries) {
        timeseries.selected = !timeseries.selected;
        this.updateSelection();
    }

    protected prepareResult(result: ExtendedTimeseries, selection: boolean) {
        result.selected = selection;
        this.timeseriesList.push(result);
        this.updateSelection();
    }

    private updateSelection() {
        const selection = this.timeseriesList.filter((entry) => entry.selected);
        this.onSelectionChanged.emit(selection);
    }

}
