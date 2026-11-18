import { evaluacionColegio } from "@/lib/evaluacionColegio";

test("la evaluación solo se aplica a IE 249 y a sus variantes con ceros iniciales", () => {
  for (const ie of ["249", "0249", "0000249", " 0249 "]) expect(evaluacionColegio(ie)?.n_evaluados_reales).toBe(341);
  for (const ie of ["9001", "831305", "864785", "249otro", "249.0", "2490", "", null, undefined]) expect(evaluacionColegio(ie)).toBeNull();
});

test("matriz, métricas macro, curva ROC y salones pertenecen a la misma evaluación", () => {
  const e=evaluacionColegio("249")!;
  const [[tn,fp],[fn,tp]]=e.graficos.matriz_confusion;
  const n=tn+fp+fn+tp;
  expect((tn+tp)/n).toBeCloseTo(e.metricas_macro.accuracy_cv,12);
  expect((tp/(tp+fp)+tn/(tn+fn))/2).toBeCloseTo(e.metricas_macro.precision_macro_cv,12);
  expect((tp/(tp+fn)+tn/(tn+fp))/2).toBeCloseTo(e.metricas_macro.recall_macro_cv,12);
  expect((2*tp/(2*tp+fp+fn)+2*tn/(2*tn+fp+fn))/2).toBeCloseTo(e.metricas_macro.f1_macro_cv,12);
  const {fpr,tpr,auc}=e.graficos.roc;
  let area=0;
  for(let i=1;i<fpr.length;i++) {
    expect(fpr[i]).toBeGreaterThanOrEqual(fpr[i-1]);
    expect(tpr[i]).toBeGreaterThanOrEqual(tpr[i-1]);
    area+=(fpr[i]-fpr[i-1])*(tpr[i]+tpr[i-1])/2;
  }
  expect(area).toBeCloseTo(auc,12);
  expect(auc).toBeCloseTo(e.metricas_macro.auc_cv,12);
  expect(e.graficos.por_salon.reduce((s,c)=>s+c.total,0)).toBe(n);
  expect(e.graficos.por_salon.reduce((s,c)=>s+c.en_riesgo_predicho,0)).toBe(tp+fp);
  expect(e.graficos.por_salon.reduce((s,c)=>s+c.en_riesgo_real,0)).toBe(tp+fn);
});
