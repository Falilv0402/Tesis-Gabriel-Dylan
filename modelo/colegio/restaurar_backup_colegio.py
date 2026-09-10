"""
restaurar_backup_colegio.py — Revierte el modelo de un colegio a una copia
de respaldo anterior, guardada automáticamente por train_colegio_model.py
antes de cada reentrenamiento (ver _respaldar_modelo_anterior()).

Uso:
    # Listar los respaldos disponibles para un colegio:
    python modelo/colegio/restaurar_backup_colegio.py --ie 0249 --listar

    # Restaurar el respaldo MÁS RECIENTE (deshacer el último reentrenamiento):
    python modelo/colegio/restaurar_backup_colegio.py --ie 0249

    # Restaurar un respaldo específico (usar el nombre que aparece en --listar):
    python modelo/colegio/restaurar_backup_colegio.py --ie 0249 --fecha 20260910_143012
"""
import argparse
import shutil
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parents[1] / "model"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ie", required=True, help="Código IE del colegio (tal como aparece en colegio_{ie}.pkl)")
    parser.add_argument("--fecha", default=None, help="Timestamp del respaldo a restaurar (ver --listar). Si se omite, usa el más reciente.")
    parser.add_argument("--listar", action="store_true", help="Solo lista los respaldos disponibles, sin restaurar nada.")
    args = parser.parse_args()

    output_path = MODEL_DIR / f"colegio_{args.ie}.pkl"
    backup_dir = MODEL_DIR / "backups" / output_path.stem
    backups = sorted(backup_dir.glob("*.pkl")) if backup_dir.exists() else []

    if not backups:
        print(f"No hay respaldos para el colegio {args.ie} en {backup_dir}")
        return

    if args.listar:
        print(f"Respaldos disponibles para {args.ie} (el más reciente es el que se usaría por defecto):")
        for b in reversed(backups):
            print(f"  {b.stem}")
        return

    elegido = backups[-1] if args.fecha is None else backup_dir / f"{args.fecha}.pkl"
    if not elegido.exists():
        print(f"No existe el respaldo '{elegido.name}'. Usa --listar para ver los disponibles.")
        return

    if output_path.exists():
        # El modelo actual (el que se va a reemplazar) también se respalda,
        # por si la restauración fue un error y hay que deshacerla también.
        shutil.copy2(output_path, backup_dir / "antes_de_restaurar.pkl")
    shutil.copy2(elegido, output_path)
    print(f"Restaurado: {output_path.name} <- backups/{output_path.stem}/{elegido.name}")
    print("Recuerda: si el backend está corriendo, la próxima consulta ya usará este modelo (se carga en cada request).")


if __name__ == "__main__":
    main()
