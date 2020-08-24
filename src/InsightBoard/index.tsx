import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Record, Field, Filters, IMeasure } from '../interfaces';
import { Insight, Utils, UnivariateSummary } from 'visual-insights';
import { baseVis } from './std2vegaSpec';
import embed from 'vega-embed';
import { getExplaination, IVisSpace } from '../services';
import { Spinner } from '@tableau/tableau-ui';
import RadioGroupButtons from './radioGroupButtons';
import { IExplaination } from '../insights';
import { mergeMeasures } from './utils';

const collection  = Insight.IntentionWorkerCollection.init();
type IReasonType = 'selection_dim_distribution' | 'selection_mea_distribution' | 'children_major_factor' | 'children_outlier';

const ReasonTypeNames: { [key: string]: string} = {
  'selection_dim_distribution': '选择集+新维度',
  'selection_mea_distribution': '选择集+新度量',
  'children_major_factor': '子节点主因',
  'children_outlier': '子节点异常'
}
collection.enable(Insight.DefaultIWorker.cluster, false);
interface SubSpace {
  dimensions: string[];
  measures: IMeasure[];
}

interface InsightBoardProps {
  dataSource: Record[];
  fields: Field[];
  filters?: Filters;
  viewDs: Field[];
  viewMs: Field[];
}
const InsightBoard: React.FC<InsightBoardProps> = props => {
  const { dataSource, fields, viewDs, viewMs, filters } = props;
  const [recSpaces, setRecSpaces] = useState<IExplaination[]>([]);
  const [visSpaces, setVisSpaces] = useState<IVisSpace[]>([]);
  const [visIndex, setVisIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const container = useRef<HTMLDivElement>(null);

  const dimsWithTypes = useMemo(() => {
    const dimensions = fields
      .filter((f) => f.type === 'D')
      .map((f) => f.id)
      .filter((f) => !Utils.isFieldUnique(dataSource, f));
    return UnivariateSummary.getAllFieldTypes(dataSource, dimensions);
  }, [fields, dataSource])

  const measWithTypes = useMemo(() => {
    const measures = fields.filter((f) => f.type === 'M').map((f) => f.id);
    return measures.map((m) => ({
      name: m,
      type: 'quantitative',
    }));
  }, [fields]);

  useEffect(() => {
    if (dimsWithTypes.length > 0 && measWithTypes.length > 0 && dataSource.length > 0) {
      const measures = fields.filter((f) => f.type === 'M').map((f) => f.id);
      const dimensions = dimsWithTypes.map(d => d.name);
      const currentSpace: SubSpace = {
          dimensions: viewDs.map((f) => f.id),
          measures: viewMs.map((f) => ({
            key: f.id,
            op: f.aggName as any
          })),
      };
      setLoading(true);
      getExplaination({
        dimensions,
        measures,
        dataSource,
        currentSpace,
        filters
      }).then(({ visSpaces, explainations }) => {
        setRecSpaces(explainations);
        setVisSpaces(visSpaces);
        setLoading(false);
      })
    }
  }, [fields, viewDs, viewMs, measWithTypes, filters, dimsWithTypes, measWithTypes, dataSource])

  const fieldsWithType = useMemo(() => {
    return [...dimsWithTypes, ...measWithTypes];
  }, [dimsWithTypes, measWithTypes])

  useEffect(() => {
    const RecSpace = recSpaces[visIndex];
    const visSpec = visSpaces[visIndex];
    if (container.current && RecSpace && visSpec) {
      const usePredicates: boolean =
          RecSpace.type === 'selection_dim_distribution' ||
          RecSpace.type === 'selection_mea_distribution';
      const mergedMeasures = mergeMeasures(RecSpace.measures, RecSpace.extendMs);
      const _vegaSpec = baseVis(
          visSpec.schema,
          visSpec.schema.geomType && visSpec.schema.geomType[0] === 'point'
              ? dataSource
              : visSpec.dataView,
          // result.aggData,
          [...RecSpace.dimensions, ...RecSpace.extendDs],
          [...RecSpace.measures, ...RecSpace.extendMs].map(m => m.key),
          usePredicates ? RecSpace.predicates : null,
          mergedMeasures.map((m) => ({
              op: m.op,
              field: m.key,
              as: m.key,
          })),
          fieldsWithType as any,
          true,
          true
      );
      if (container.current) {
        console.log(_vegaSpec)
        embed(container.current, _vegaSpec);
      }
    }
  }, [visIndex, recSpaces, visSpaces, fieldsWithType, dataSource])

  const FilterDesc = useMemo<string>(() => {
    if (filters) {
      const values = Object.keys(filters)
      .filter(k => filters[k].length > 0)
        .map((k) => {
          return `${k}=${filters[k]}`;
        });
      return `取值为${values.join(', ')}的数据还可能有以下洞察!`; 
    }
    return ''
  }, [filters])

  return (
    <div style={{ maxHeight: '720px', minHeight: '200px', overflowY: 'auto', maxWidth: '880px' }}>
      <p>{FilterDesc}</p>
      {loading && (
        <div aria-busy style={{ display: 'inline-block' }}>
          <Spinner />
        </div>
      )}
      <div style={{ display: 'flex' }}>
        <div style={{ flexBasis: '200px', flexShrink: 0 }}>
          <RadioGroupButtons
            choosenIndex={visIndex}
            options={recSpaces.map((s, i) => ({
              value: s.type || '' + i,
              label: `${s.type ? ReasonTypeNames[s.type] : '未识别'}: ${Math.round(s.score * 100)}%`,
            }))}
            onChange={(v, i) => {
              setVisIndex(i);
            }}
          />
        </div>
        <div>
          <div ref={container}></div>
          {recSpaces[visIndex] && (
            <p>
              维度是{recSpaces[visIndex].dimensions.join(', ')}。<br />
              度量是{recSpaces[visIndex].measures.join(', ')}。<br />
              此时具有
              {recSpaces[visIndex].type
                ? ReasonTypeNames[recSpaces[visIndex].type!]
                : '未识别'}{' '}
              ，显著性为{Math.round(recSpaces[visIndex].score * 100)}%。
              <br />
              {recSpaces[visIndex].description &&
                `详情：${JSON.stringify(
                  recSpaces[visIndex].description,
                  null,
                  2
                )}。`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsightBoard;
