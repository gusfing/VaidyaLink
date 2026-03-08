interface RecordCardProps {
  id: string;
  title: string;
  category: 'prescription' | 'lab-report' | 'scan' | 'other';
  date: string;
  thumbnailUrl?: string;
  verified: boolean;
  onClick: () => void;
}

const categoryColors = {
  prescription: '#4CAF50',
  'lab-report': '#2196F3',
  scan: '#FF9800',
  other: '#9E9E9E',
};

const categoryIcons = {
  prescription: 'medication',
  'lab-report': 'science',
  scan: 'radiology',
  other: 'description',
};

export default function RecordCard({
  title,
  category,
  date,
  thumbnailUrl,
  verified,
  onClick,
}: RecordCardProps) {
  return (
    <div className="record-card" onClick={onClick}>
      <div className="thumbnail">
        {thumbnailUrl ? (
          <div className="thumb-placeholder">
            <span className="material-symbols-outlined">image</span>
          </div>
        ) : (
          <div className="thumb-placeholder">
            <span className="material-symbols-outlined">{categoryIcons[category]}</span>
          </div>
        )}
        {verified && (
          <span className="verified-badge">
            <span className="material-symbols-outlined">verified</span>
          </span>
        )}
      </div>

      <div className="card-content">
        <h4>{title}</h4>
        <div className="card-meta">
          <span className="category-tag" style={{ backgroundColor: categoryColors[category] }}>
            {category.replace('-', ' ')}
          </span>
          <span className="date">{new Date(date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
