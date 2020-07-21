import { Insight } from 'visual-insights';
import { Record } from './interfaces';
import { checkMajorFactor } from './utils';

class DataExpaliner {
    public dataSource: Record[];
    private dimensions: string[];
    private measures: string[];
    private engine: Insight.VIEngine;
    constructor (dataSource: Record[] = []) {
        this.engine = new Insight.VIEngine();
        this.dataSource = dataSource;
        this.dimensions = [];
        this.measures = [];
        let keys: string[] = [];
        if (dataSource.length > 0) {
            keys = Object.keys(dataSource[0]);
        }
        this.engine.setDataSource(dataSource)
            .setFieldKeys(keys)
            .buildfieldsSummary();
        // const newKeys = this.engine.fields.filter(f => f.domain.size < 40).map(f => f.key);
        // this.engine.setFieldKeys(keys);
        // const keys = Object.keys(dataSource[0])
    }
    public setDimensions (dimensions: string[]) {
        this.dimensions = dimensions;
        this.engine.setDimensions(dimensions);
    }
    public setMeasures (measures: string[]) {
        this.measures = measures;
        this.engine.setMeasures(measures);
    }
    public preAnalysis() {
        this.engine.buildGraph()
            .clusterFields()
            .buildSubspaces()
            .buildCube();
    }
    public explain (record: Record[], dimensions: string[], measures: string[]) {

    }
    public explainByMajorFactor(dimensions: string[], K_Neighbor: number = 3) {
        // 1. find most relative dimensions(topK)
        // 2. for each dimension, we check all the dim member in it. find the member whos distribution is most close to current one.
        // here we do not nomorlize all the dim member's distribution, we use the relative distribution instead.
        // 3. the dim member we found can be used to explain current one as major factor.
        const knn = this.getKNN(dimensions, K_Neighbor);
        for (let extendDim of knn) {
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim]);
            const data = cuboid.state;
            let groups: Map<any, Record[]> = new Map();
            for (let record of data) {
                if (!groups.has(record[extendDim])) {
                    groups.set(record[extendDim], [])
                }
                groups.get(record[extendDim])?.push(record)
            }
            const { majorKey, majorSum } = checkMajorFactor(data, groups, dimensions, this.measures)
        }
    }
    public getKNN(dimensions: string[] ,K_Neighbor: number = 3) {
        const adjMatrix = this.engine.dataGraph.DG;
        const graphDimensions = this.engine.dataGraph.dimensions;
        const dimIndices = dimensions.map(dim => graphDimensions.indexOf(dim));
        const neighbors: Array<{dis: number, index: number}> = [];
        for (let dimIndex of dimIndices) {
            for (let i = 0; i < adjMatrix[dimIndex].length; i++) {
                if (!dimIndices.includes(i)) {
                    neighbors.push({
                        dis: Math.abs(adjMatrix[dimIndex][i]),
                        index: i
                    })
                }
            }
        }
        neighbors.sort((a, b) => b.dis - a.dis);
        return neighbors.slice(0, K_Neighbor).map(f => graphDimensions[f.index]);
    }
}