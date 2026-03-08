interface PatientSnapshotProps {
  patient: {
    name: string;
    age: number;
    gender: string;
    abhaId: string;
    photoUrl?: string;
    lastVisit: string;
  };
}

export default function PatientSnapshot({ patient }: PatientSnapshotProps) {
  return (
    <div className="patient-snapshot">
      <div className="patient-photo">
        <span className="material-symbols-outlined">person</span>
      </div>
      <div className="patient-details">
        <h3>{patient.name}</h3>
        <p className="demographics">
          {patient.age} years • {patient.gender}
        </p>
        <p className="abha-id">ABHA: {patient.abhaId}</p>
        <p className="last-visit">Last visit: {patient.lastVisit}</p>
      </div>
    </div>
  );
}
