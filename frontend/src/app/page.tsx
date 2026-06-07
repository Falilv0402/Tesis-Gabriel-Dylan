"use client";

import {
  Activity, AlertTriangle, Bell, CheckCircle2,
  LogOut, ShieldCheck, X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useModelData } from "@/hooks/useModelData";
import { useStudents } from "@/hooks/useStudents";
import { useInterventions } from "@/hooks/useInterventions";
import { useToast } from "@/hooks/useToast";

import { navItems, apiUrl } from "@/lib/constants";
import { exportCsv, exportXlsx, exportPdf } from "@/lib/exports";

import { Avatar } from "@/components/ui/Avatar";
import { ComparatorModal } from "@/components/modals/ComparatorModal";
import { IeProfileModal } from "@/components/modals/IeProfileModal";
import { ProfilePanel } from "@/components/modals/ProfilePanel";

import { AuthView } from "@/views/AuthView";
import { DashboardView } from "@/views/DashboardView";
import { EstudianteView } from "@/views/EstudianteView";
import { IntervencionesView } from "@/views/IntervencionesView";
import { DatosView } from "@/views/DatosView";
import { ModeloView } from "@/views/ModeloView";
import { ReportesView } from "@/views/ReportesView";
import { UsuariosView } from "@/views/UsuariosView";
import { ColegioDashboardView } from "@/views/ColegioDashboardView";
import { ColegioReportesView } from "@/views/ColegioReportesView";
import { ColegioEstudianteView } from "@/views/ColegioEstudianteView";
import { ColegioIntervencionesView } from "@/views/ColegioIntervencionesView";
import { useColegio } from "@/hooks/useColegio";
import { colegioStudentId, colegioToStudent } from "@/lib/colegio";

import type { Tab, UserRole } from "@/types";

export default function Page() {
  // ── Core UI state ─────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("dashboard");
  const [actionBusy, setActionBusy] = useState(false);
  // Alumno seleccionado dentro del modelo del colegio (vista director con IE propia)
  const [selectedColegioId, setSelectedColegioId] = useState("");

  const {
    toasts, notifInbox, notifCount, setNotifCount,
    showNotifInbox, setShowNotifInbox,
    toast, clearNotifs,
  } = useToast();

  // ── Hooks ─────────────────────────────────────────────────────────
  const auth = useAuth(toast);
  const admin = useAdmin(auth.session, auth.role, tab, toast, auth.insertAudit, auth.profileCodigoIe);
  const modelData = useModelData(admin.apiConnected, admin.setApiConnected, toast);

  // Datos del modelo interno del colegio (solo si la IE del usuario tiene uno).
  const colegio = useColegio(auth.profileCodigoIe);

  // Alumno de colegio seleccionado (por defecto, el de mayor riesgo) y su
  // adaptación a la forma `Student` para reutilizar los hooks compartidos.
  const colegioSelectedAlumno = useMemo(() => {
    if (!colegio.hasModel || colegio.alumnos.length === 0) return undefined;
    const found = colegio.alumnos.find((a) => colegioStudentId(a) === selectedColegioId);
    if (found) return found;
    return [...colegio.alumnos].sort((a, b) => b.prob_riesgo - a.prob_riesgo)[0];
  }, [colegio.hasModel, colegio.alumnos, selectedColegioId]);

  const colegioSelectedStudent = useMemo(
    () => colegioSelectedAlumno ? colegioToStudent(colegioSelectedAlumno, auth.profileDistrito) : undefined,
    [colegioSelectedAlumno, auth.profileDistrito]
  );

  const students = useStudents(
    auth.profileCodigoIe, auth.profileDistrito, auth.role, auth.session,
    modelData.thresholdHigh, modelData.thresholdMedium,
    modelData.diagnostico,
    admin.apiConnected, admin.setApiConnected,
    toast, auth.insertAudit,
    colegio.hasModel ? colegioSelectedStudent : undefined,
  );

  // Estudiante "activo" para las features compartidas (anotaciones, plan,
  // intervenciones): el alumno del colegio si la IE tiene modelo propio, o el
  // alumno EM 2022 seleccionado en caso contrario.
  const activeSelected = colegio.hasModel ? colegioSelectedStudent : students.selected;

  const interventions = useInterventions(
    auth.session, activeSelected,
    auth.profileCodigoIe, auth.profileDistrito,
    "distrito", auth.role, toast, auth.insertAudit
  );

  // ── Navigation ────────────────────────────────────────────────────
  const notifCount4Nav = interventions.interventions.filter(i => i.estado === "pendiente").length;

  const directorTabs   = ["dashboard", "estudiante", "reportes", "intervenciones"]; // también coordinador
  const adminTabs      = ["usuarios", "datos"];
  const superadminTabs = ["usuarios", "datos", "modelo"];

  const isAdmin      = auth.role === "admin" || auth.role === "superadmin";
  const isSuperadmin = auth.role === "superadmin";
  const isDirector   = auth.role === "director";
  const isDirectorRole = auth.role === "director" || auth.role === "coordinador";

  // Filtrar navegación según el rol del usuario
  const visibleNav = navItems.filter((item) =>
    item.roles.includes(auth.role as UserRole)
  );

  // Redirige al primer tab visible cuando el rol carga y el tab actual no es accesible
  useEffect(() => {
    if (!auth.role) return;
    const allowed = isSuperadmin ? superadminTabs : isAdmin ? adminTabs : directorTabs;
    if (!allowed.includes(tab)) {
      setTab(allowed[0] as Tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.role]);

  // Recarga datos del modelo cada vez que el superadmin entra al tab "modelo"
  useEffect(() => {
    if (isSuperadmin && tab === "modelo") {
      void modelData.loadModelMetrics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Export functions ──────────────────────────────────────────────
  function handleExportCsv() {
    exportCsv(students.filtered);
  }

  function handleExportXlsx() {
    exportXlsx(students.filtered, modelData.metrics, students.high, students.medium, students.low);
    void auth.insertAudit("Exportar XLSX", "reportes", { filtrados: students.filtered.length });
    toast("Excel exportado correctamente", "success");
  }

  function handleExportPdf() {
    exportPdf(
      students.filtered, modelData.metrics,
      students.displayTotal, students.high, students.medium, students.low,
      auth.session?.email ?? "usuario",
    );
    void auth.insertAudit("Exportar PDF", "reportes", { filtrados: students.filtered.length });
    toast("PDF generado correctamente", "success");
  }

  async function retrain() {
    modelData.setModelMessage("Reentrenando modelo...");
    try {
      const response = await fetch(`${apiUrl}/v1/modelo/reentrenamiento`, { method: "POST" });
      const payload = await response.json();
      if (response.ok) {
        modelData.setModelMessage("Modelo reentrenado correctamente.");
        await modelData.loadModelMetrics();
        await students.loadStudents();
        // Restablecer umbrales al reentrenar
        modelData.setThresholdHigh(70);
        modelData.setThresholdMedium(45);
        toast("Modelo actualizado. Umbrales restablecidos a 70% / 45%.", "success");
      } else {
        modelData.setModelMessage(payload.detail ?? "Error al reentrenar.");
      }
    } catch {
      modelData.setModelMessage("No se pudo reentrenar. Revisa que FastAPI este activo.");
    }
  }

  // ── Loading state ─────────────────────────────────────────────────
  if (auth.authLoading) {
    return (
      <main className="auth-screen">
        <section className="auth-panel" style={{ textAlign: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Logo Icono SATRA_fondo_transparente.png" alt="SATRA" className="auth-icon spinning" style={{ width: 48, margin: "0 auto" }} />
          <p className="audit-line" style={{ textAlign: "center" }}>Verificando sesion...</p>
        </section>
      </main>
    );
  }

  // ── Auth screen ───────────────────────────────────────────────────
  if (!auth.session) {
    return (
      <AuthView
        authMode={auth.authMode} setAuthMode={auth.setAuthMode}
        authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
        authPassword={auth.authPassword} setAuthPassword={auth.setAuthPassword}
        authNombre={auth.authNombre} setAuthNombre={auth.setAuthNombre}
        authError={auth.authError} authMsg={auth.authMsg} authBusy={auth.authBusy}
        regDistrito={auth.regDistrito} setRegDistrito={auth.setRegDistrito}
        regColegioIe={auth.regColegioIe} setRegColegioIe={auth.setRegColegioIe}
        regColegiosList={auth.regColegiosList}
        ieHasDirector={auth.ieHasDirector}
        distritosList={auth.distritosList}
        handleLogin={auth.handleLogin}
        handleRegister={auth.handleRegister}
        handlePasswordReset={auth.handlePasswordReset}
      />
    );
  }

  // ── Main app shell ────────────────────────────────────────────────
  return (
    <main className="app-shell">
      <a href="#main-content" className="skip-nav">Saltar al contenido principal</a>

      {/* Sidebar */}
      <aside className="sidebar" role="navigation" aria-label="Navegación principal">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Logo SATRA(1)_fondo_transparente.png" alt="SATRA logo" className="brand-logo" />
          <div className="brand-text">
            <strong>SATRA</strong>
            <span>Sistema de Alerta Temprana de{"\n"}Riesgo Académico</span>
          </div>
        </div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const badge = item.id === "intervenciones" && notifCount4Nav > 0;
            return (
              <button key={item.id} className={tab === item.id ? "nav active" : "nav"} onClick={() => setTab(item.id)}>
                <Icon size={18} /> {item.label}
                {badge && <span className="notif-badge">{notifCount4Nav}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Workspace */}
      <section className="workspace" id="main-content" role="main" aria-label="Área de trabajo">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.id === tab)?.label}</h1>
            <span>
              {isAdmin ? "Configuracion del sistema" : "Seguimiento academico"} · {modelData.metrics.trained_at ?? "pendiente"}
              &nbsp;·&nbsp;
              <span className={`api-dot ${admin.apiConnected === true ? "connected" : admin.apiConnected === false ? "disconnected" : "pending"}`} />
              {admin.apiConnected === true ? "Backend conectado" : admin.apiConnected === false ? "Backend desconectado" : "Verificando..."}
            </span>
          </div>
          <div className="top-actions">
            {isDirectorRole && (
              auth.profileDistrito ? (
                <span className="district-badge">
                  <ShieldCheck size={13} />
                  <span>
                    <strong>
                      {auth.profileNombreIe ?? auth.profileDistrito}
                    </strong>
                    {auth.profileNombreIe
                      ? <em>{auth.profileDistrito}</em>
                      : auth.profileCodigoIe && <em>IE {auth.profileCodigoIe}</em>}
                  </span>
                </span>
              ) : (
                <span className="district-badge district-badge-warn" title="Sin distrito asignado">
                  <AlertTriangle size={13} />
                  <span><strong>Sin distrito</strong></span>
                </span>
              )
            )}
            <button className="notif-bell-btn" onClick={() => { setShowNotifInbox((v) => !v); setNotifCount(0); }} title="Bandeja de notificaciones">
              <Bell size={18} />
              {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
            </button>
            <button className="user-badge-btn" onClick={auth.openProfilePanel} title="Editar perfil">
              <Avatar nombre={auth.profileNombre} apellidos={auth.profileApellidos} email={auth.session.email ?? ""} color={auth.profileAvatarColor} size={32} />
              <span className="user-badge-info">
                <strong>{auth.profileNombre ? `${auth.profileNombre}${auth.profileApellidos ? " " + auth.profileApellidos : ""}` : (auth.session.email?.split("@")[0] ?? "usuario")}</strong>
                <em>{auth.role}</em>
              </span>
            </button>
            <button onClick={() => void auth.handleLogout()}><LogOut size={16} /> Salir</button>
          </div>
        </header>

        {/* Notification inbox */}
        {showNotifInbox && (
          <div className="notif-inbox-overlay" onClick={() => setShowNotifInbox(false)}>
            <div className="notif-inbox" onClick={(e) => e.stopPropagation()}>
              <div className="notif-inbox-header">
                <Bell size={16} /><strong>Notificaciones</strong>
                <button className="notif-inbox-close" onClick={() => setShowNotifInbox(false)}><X size={16} /></button>
              </div>
              {notifInbox.length === 0 ? (
                <div className="notif-inbox-empty">Sin notificaciones recientes</div>
              ) : (
                <ul className="notif-inbox-list">
                  {notifInbox.map((n) => (
                    <li key={n.id} className={`notif-inbox-item notif-${n.type}${n.read ? " notif-read" : ""}`}>
                      <span className="notif-inbox-msg">{n.msg}</span>
                      <span className="notif-inbox-ts">{n.ts.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              )}
              {notifInbox.length > 0 && (
                <button className="notif-inbox-clear" onClick={clearNotifs}>
                  Limpiar bandeja
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        <ComparatorModal
          show={students.showComparator}
          comparatorIds={students.comparatorIds}
          classifiedStudents={students.classifiedStudents}
          filtered={students.filtered}
          onClose={() => students.setShowComparator(false)}
          onToggle={students.toggleComparator}
        />
        <IeProfileModal
          show={students.showIeProfile}
          ieProfileId={students.ieProfileId}
          classifiedStudents={students.classifiedStudents}
          onClose={() => students.setShowIeProfile(false)}
        />

        {/* Tab content */}
        <section className="content-area">
          {isDirectorRole && tab === "dashboard" && colegio.hasModel && (
            <ColegioDashboardView
              nombreColegio={colegio.resumen?.nombre_colegio ?? auth.profileNombreIe ?? "Mi colegio"}
              alumnos={colegio.alumnos}
              resumen={colegio.resumen}
              isLoading={colegio.isLoading}
              onRefresh={() => void colegio.reload()}
              onSelect={(a) => { setSelectedColegioId(colegioStudentId(a)); setTab("estudiante"); }}
            />
          )}

          {isDirectorRole && tab === "dashboard" && !colegio.hasModel && (
            <DashboardView
              filtered={students.filtered} selected={students.selected}
              displayTotal={students.displayTotal} high={students.high} medium={students.medium} low={students.low}
              avgIse={students.avgIse} totalStudents={students.totalStudents}
              isLoadingMore={students.isLoadingMore} isLoadingModel={modelData.isLoadingModel}
              isSavingPredictions={students.isSavingPredictions} predictionsSaved={students.predictionsSaved}
              students={students.students} metrics={modelData.metrics} summary={students.summary}
              districtRiskMap={students.districtRiskMap} classifiedStudents={students.classifiedStudents}
              risk={students.risk} setRisk={students.setRisk}
              distrito={students.distrito} setDistrito={students.setDistrito}
              sexo={students.sexo} setSexo={students.setSexo}
              segment={students.segment} setSegment={students.setSegment}
              search={students.search} setSearch={students.setSearch}
              selectedId={students.selectedId} setSelectedId={students.setSelectedId}
              profileDistrito={auth.profileDistrito} setTab={setTab}
              loadModelData={async () => { await modelData.loadModelMetrics(); await students.loadStudents(); }}
              exportCsv={handleExportCsv} exportXlsx={handleExportXlsx}
              savePredictionsToSupabase={students.savePredictionsToSupabase}
              loadMoreStudents={() => void students.loadMoreStudents()}
            />
          )}

          {isDirectorRole && tab === "estudiante" && colegio.hasModel && (
            <ColegioEstudianteView
              role={auth.role}
              alumno={colegioSelectedAlumno}
              annotations={interventions.annotations}
              annotationText={interventions.annotationText} setAnnotationText={interventions.setAnnotationText}
              isSavingAnnotation={interventions.isSavingAnnotation}
              planMilestones={students.planMilestones}
              newMilestone={students.newMilestone} setNewMilestone={students.setNewMilestone}
              newMilestoneDate={students.newMilestoneDate} setNewMilestoneDate={students.setNewMilestoneDate}
              studentTab={students.studentTab} setStudentTab={students.setStudentTab}
              setTab={setTab}
              saveAnnotation={() => void interventions.saveAnnotation()}
              loadAnnotations={(id) => void interventions.loadAnnotations(id)}
              addMilestone={() => void students.addMilestone()}
              toggleMilestone={(id) => void students.toggleMilestone(id)}
              loadMilestones={(id) => void students.loadMilestones(id)}
              isLoadingMilestones={students.isLoadingMilestones}
            />
          )}

          {isDirectorRole && tab === "estudiante" && !colegio.hasModel && (
            <EstudianteView
              role={auth.role}
              selected={students.selected} shapData={students.shapData} shapLoading={students.shapLoading}
              annotations={interventions.annotations}
              annotationText={interventions.annotationText} setAnnotationText={interventions.setAnnotationText}
              isSavingAnnotation={interventions.isSavingAnnotation}
              isGeneratingStudentPdf={interventions.isGeneratingStudentPdf}
              planMilestones={students.planMilestones}
              newMilestone={students.newMilestone} setNewMilestone={students.setNewMilestone}
              newMilestoneDate={students.newMilestoneDate} setNewMilestoneDate={students.setNewMilestoneDate}
              studentTab={students.studentTab} setStudentTab={students.setStudentTab}
              comparatorIds={students.comparatorIds} setTab={setTab}
              exportStudentPdf={() => void interventions.exportStudentPdf(students.shapData, auth.session?.email ?? "")}
              saveAnnotation={() => void interventions.saveAnnotation()}
              loadAnnotations={(id) => void interventions.loadAnnotations(id)}
              toggleComparator={students.toggleComparator}
              setShowComparator={students.setShowComparator}
              setIeProfileId={students.setIeProfileId}
              setShowIeProfile={students.setShowIeProfile}
              addMilestone={() => void students.addMilestone()}
              toggleMilestone={(id) => void students.toggleMilestone(id)}
              loadMilestones={(id) => void students.loadMilestones(id)}
              isLoadingMilestones={students.isLoadingMilestones}
            />
          )}

          {isDirectorRole && tab === "intervenciones" && colegio.hasModel && (
            <ColegioIntervencionesView
              role={auth.role}
              alumnos={colegio.alumnos}
              selectedAlumno={colegioSelectedAlumno}
              onSelectAlumno={(id) => setSelectedColegioId(id)}
              tipoIntervencion={interventions.tipoIntervencion} setTipoIntervencion={interventions.setTipoIntervencion}
              descIntervencion={interventions.descIntervencion} setDescIntervencion={interventions.setDescIntervencion}
              notifScope={interventions.notifScope} setNotifScope={interventions.setNotifScope}
              isSendingAlert={interventions.isSendingAlert}
              profileDistrito={auth.profileDistrito} profileCodigoIe={auth.profileCodigoIe}
              interventions={interventions.interventions} interventionStats={interventions.interventionStats}
              authBusy={actionBusy}
              onRegistrar={() => void interventions.handleRegistrarIntervencion(actionBusy, setActionBusy)}
              onSendAlert={() => void interventions.sendTeamAlert()}
              onUpdateEstado={(id, estado) => void admin.updateEstadoIntervencion(id, estado, interventions.setInterventions)}
              onLoadInterventions={() => void interventions.loadInterventions()}
            />
          )}

          {isDirectorRole && tab === "intervenciones" && !colegio.hasModel && (
            <IntervencionesView
              role={auth.role}
              selected={students.selected} filtered={students.filtered}
              tipoIntervencion={interventions.tipoIntervencion} setTipoIntervencion={interventions.setTipoIntervencion}
              descIntervencion={interventions.descIntervencion} setDescIntervencion={interventions.setDescIntervencion}
              notifScope={interventions.notifScope} setNotifScope={interventions.setNotifScope}
              isSendingAlert={interventions.isSendingAlert}
              profileDistrito={auth.profileDistrito} profileCodigoIe={auth.profileCodigoIe}
              interventions={interventions.interventions} interventionStats={interventions.interventionStats}
              authBusy={actionBusy} setSelectedId={students.setSelectedId}
              onRegistrar={() => void interventions.handleRegistrarIntervencion(actionBusy, setActionBusy)}
              onSendAlert={() => void interventions.sendTeamAlert()}
              onUpdateEstado={(id, estado) => void admin.updateEstadoIntervencion(id, estado, interventions.setInterventions)}
              onLoadInterventions={() => void interventions.loadInterventions()}
            />
          )}

          {isDirectorRole && tab === "reportes" && colegio.hasModel && (
            <ColegioReportesView
              nombreColegio={colegio.resumen?.nombre_colegio ?? auth.profileNombreIe ?? "Mi colegio"}
              alumnos={colegio.alumnos}
              resumen={colegio.resumen}
              onSelect={(a) => { setSelectedColegioId(colegioStudentId(a)); setTab("estudiante"); }}
            />
          )}

          {isDirectorRole && tab === "reportes" && !colegio.hasModel && (
            <ReportesView
              summary={students.summary}
              filtered={students.filtered}
              high={students.high}
              medium={students.medium}
              low={students.low}
              displayTotal={students.displayTotal}
              exportCsv={handleExportCsv}
              exportXlsx={handleExportXlsx}
              exportPdf={handleExportPdf}
            />
          )}

          {isAdmin && tab === "datos" && (
            <DatosView
              fileInputRef={admin.fileInputRef}
              uploadResult={admin.uploadResult} setUploadResult={admin.setUploadResult}
              csvValidation={admin.csvValidation} isValidating={admin.isValidating}
              scheduleFreq={admin.scheduleFreq} setScheduleFreq={admin.setScheduleFreq}
              nextUpdate={admin.nextUpdate} scheduleMsg={admin.scheduleMsg}
              onValidateCsv={(file) => void admin.validateCsv(file)}
              onSaveSchedule={() => void admin.saveSchedule()}
              colegioFileRef={admin.colegioFileRef}
              colegioUploadIe={admin.colegioUploadIe}
              setColegioUploadIe={admin.setColegioUploadIe}
              colegioUploadStatus={admin.colegioUploadStatus}
              colegioUploadMsg={admin.colegioUploadMsg}
              colegioUploadResult={admin.colegioUploadResult}
              onUploadColegioExcels={(files, ie) => void admin.uploadColegioExcels(files, ie)}
              role={auth.role}
              profileCodigoIe={auth.profileCodigoIe}
              colegioModelStats={admin.colegioModelStats}
            />
          )}

          {isSuperadmin && tab === "modelo" && (
            <ModeloView
              metrics={modelData.metrics} evaluation={modelData.evaluation}
              diagnostico={modelData.diagnostico} globalSummary={modelData.globalSummary}
              topFactors={modelData.topFactors} maxImportance={modelData.maxImportance}
              liveMetrics={modelData.liveMetrics}
              thresholdHigh={modelData.thresholdHigh} setThresholdHigh={modelData.setThresholdHigh}
              thresholdMedium={modelData.thresholdMedium} setThresholdMedium={modelData.setThresholdMedium}
              scheduleFreq={admin.scheduleFreq} setScheduleFreq={admin.setScheduleFreq}
              scheduleMsg={admin.scheduleMsg} nextUpdate={admin.nextUpdate}
              modelMessage={modelData.modelMessage}
              onRetrain={() => void retrain()}
              onSaveSchedule={() => void admin.saveSchedule()}
            />
          )}

          {isAdmin && tab === "usuarios" && (
            <UsuariosView
              session={auth.session}
              role={auth.role}
              profileCodigoIe={auth.profileCodigoIe}
              dbUsers={admin.dbUsers} dbAudit={admin.dbAudit}
              showCreateUser={admin.showCreateUser} setShowCreateUser={admin.setShowCreateUser}
              newUserEmail={admin.newUserEmail} setNewUserEmail={admin.setNewUserEmail}
              newUserNombre={admin.newUserNombre} setNewUserNombre={admin.setNewUserNombre}
              newUserPwd={admin.newUserPwd} setNewUserPwd={admin.setNewUserPwd}
              newUserRol={admin.newUserRol} setNewUserRol={admin.setNewUserRol}
              newUserDistrito={admin.newUserDistrito} setNewUserDistrito={admin.setNewUserDistrito}
              distritosList={auth.distritosList}
              colegiosList={auth.colegiosList}
              authBusy={actionBusy}
              onCreateUser={() => void admin.handleCreateUser(auth.translateAuthError, actionBusy, setActionBusy)}
              onDesactivar={(id) => void admin.desactivarUsuario(id)}
              onActivar={(id) => void admin.activarUsuario(id)}
              onRefreshUsers={() => void admin.loadDbUsers()}
              onRefreshAudit={() => void admin.loadDbAudit()}
            />
          )}
        </section>

        {/* Footer */}
        <footer className="app-legal-footer">
          <ShieldCheck size={11} />
          Datos protegidos por Ley 29733. Uso educativo exclusivo. Toda consulta queda registrada en auditoría.
          <span style={{ marginLeft: "auto" }}>SATRA · UPC · P20261012</span>
        </footer>
      </section>

      {/* Profile panel */}
      <ProfilePanel
        show={auth.showProfile}
        session={auth.session}
        role={auth.role}
        editNombre={auth.editNombre} setEditNombre={auth.setEditNombre}
        editApellidos={auth.editApellidos} setEditApellidos={auth.setEditApellidos}
        editEmail={auth.editEmail} setEditEmail={auth.setEditEmail}
        editPwd={auth.editPwd} setEditPwd={auth.setEditPwd}
        editPwdConfirm={auth.editPwdConfirm} setEditPwdConfirm={auth.setEditPwdConfirm}
        profileAvatarColor={auth.profileAvatarColor} setProfileAvatarColor={auth.setProfileAvatarColor}
        profileBusy={auth.profileBusy} profileMsg={auth.profileMsg}
        onClose={() => auth.setShowProfile(false)}
        onSave={() => void auth.saveProfile()}
      />

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "success" && <CheckCircle2 size={16} />}
            {t.type === "error" && <AlertTriangle size={16} />}
            {t.type === "info" && <Activity size={16} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
