import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DraggableFields, { DraggableFieldState } from './Fields';
import { Record, Filters, Field } from './interfaces';
import { getTitanicData } from './data/titanic';
import ReactVega from './vis/react-vega';
import { GEMO_TYPES } from './config';
import { LiteForm } from './components/liteForm';
import { Container } from './components/container';
import ClickMenu from './components/clickMenu';
import InsightBoard from './InsightBoard';
import { Button, DropdownSelect, Checkbox } from '@tableau/tableau-ui';
import Model from './components/model';
import { getStudentsData } from './data/students';
import DataSourcePanel from './dataSource/index';
import { useGlobalState } from './store';


const INIT_DF_STATE: DraggableFieldState = {
  fields: [],
  rows: [],
  columns: [],
  color: [],
  opacity: [],
  size: [],
};
const DS_LIST = [
  { label: '学生分数影响因子', value: 'students', service: getStudentsData },
  { label: '泰坦尼克号', value: 'titanic', service: getTitanicData }
]
interface Dataset {
  dimensions: string[];
  measures: string[];
  dataSource: Record[]
}
function App() {
  const [GS, updateGS] = useGlobalState();
  const [fields, setFields] = useState<Field[]>([]);
  const [fstate, setFstate] = useState<DraggableFieldState>(INIT_DF_STATE);
  const [geomType, setGeomType] = useState<string>(GEMO_TYPES[0].value);
  const [aggregated, setAggregated] = useState<boolean>(true);
  const [position, setPosition] = useState<[number, number]>([0, 0]);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showInsight, setShowInsight] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({});
  const [showDSPanel, setShowDSPanel] = useState<boolean>(false);
  // const [ds, setDS] = useState<Dataset>({ dimensions: [], measures: [], dataSource: []});
  const [newDBIndex, setNewDBIndex] = useState<number>(0);
  // useEffect(() => {
  //   const target = DS_LIST.find(d => d.value === dsKey);
  //   if (target) {
  //     setDS(target.service())
  //   }
  // }, [dsKey])
  useEffect(() => {
    const fs: Field[] = [];
    const ds = GS.dataBase[GS.currentDBIndex];
    ds.fields.forEach(f => {
      fs.push({
        id: f.key,
        name: f.key,
        type: f.analyticType === "dimension" ? 'D' : 'M',
        aggName: f.analyticType === 'measure' ? 'sum' : undefined
      })
    })
    setFields(fs);
  }, [GS.currentDBIndex, GS.dataBase]);

  const viewDimensions = useMemo<Field[]>(() => {
    return [
      ...fstate.rows,
      ...fstate.columns,
      ...fstate.color,
      ...fstate.opacity,
      ...fstate.size
    ].filter(f => f.type === 'D');
  }, [fstate])
  const viewMeasures = useMemo<Field[]>(() => {
    return [
      ...fstate.rows,
      ...fstate.columns,
      ...fstate.color,
      ...fstate.opacity,
      ...fstate.size,
    ].filter((f) => f.type === 'M');
  }, [fstate]);

  const createDB = useCallback(() => {
    updateGS(draft => {
      const newLastIndex = draft.dataBase.length;
      draft.dataBase.push({
        id: 'ds_' + newLastIndex,
        name: '新数据源' + newLastIndex,
        dataSource: [],
        fields: []
      })
      setNewDBIndex(newLastIndex);
    })
  }, []);

  return (
    <div className="App">
      <Container>
        <label style={{ fontSize: '12px', marginRight: '4px' }}>
          当前数据集
        </label>
        <DropdownSelect
          value={GS.dataBase[GS.currentDBIndex].id}
          onChange={(e) => {
            // setDSKey(e.target.value);
            updateGS(draft => {
              const index = draft.dataBase.findIndex(ds => ds.id === e.target.value);
              draft.currentDBIndex = index;
            })
          }}
        >
          {GS.dataBase.map((ds) => (
            <option value={ds.id} key={ds.id}>
              {ds.name}
            </option>
          ))}
        </DropdownSelect>
        <Button style={{ marginLeft: '8px'}} onClick={() => {
          createDB();
          setShowDSPanel(true);
        }}>创建数据集</Button>
        {
          showDSPanel && <Model title="创建数据源" onClose={() => { setShowDSPanel(false); }}>
            <DataSourcePanel dbIndex={newDBIndex} onSubmit={() => { setShowDSPanel(false); }} />
          </Model>
        }
      </Container>
      <Container>
        <DraggableFields
          onStateChange={(state) => {
            setFstate(state);
          }}
          fields={fields}
        />
      </Container>
      <Container>
        <LiteForm
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div className="item">
            <Checkbox
              checked={aggregated}
              onChange={(e) => {
                setAggregated(e.target.checked);
              }}
            >
              聚合度量
            </Checkbox>
          </div>
          <div className="item">
            <label>标记类型</label>
            <DropdownSelect
              onChange={(e) => {
                setGeomType(e.target.value);
              }}
            >
              {GEMO_TYPES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </DropdownSelect>
          </div>
        </LiteForm>
      </Container>
      <Container>
        {showInsight && (
          <Model
            onClose={() => {
              setShowInsight(false);
            }}
          >
            <InsightBoard
              dataSource={GS.dataBase[GS.currentDBIndex].dataSource}
              fields={fields}
              viewDs={viewDimensions}
              viewMs={viewMeasures}
              filters={filters}
            />
          </Model>
        )}
        {showMenu && (
          <ClickMenu x={position[0]} y={position[1]}>
            <div
              onClick={() => {
                setShowMenu(false);
                setShowInsight(true);
              }}
            >
              深度解读
            </div>
          </ClickMenu>
        )}

        <ReactVega
          geomType={geomType}
          defaultAggregate={aggregated}
          dataSource={GS.dataBase[GS.currentDBIndex].dataSource}
          rows={fstate.rows}
          columns={fstate.columns}
          color={fstate.color[0]}
          opacity={fstate.opacity[0]}
          size={fstate.size[0]}
          onGeomClick={(values, e) => {
            setFilters(values);
            setPosition([e.pageX, e.pageY]);
            setShowMenu(true);
          }}
        />
      </Container>
    </div>
  );
}

export default App;
