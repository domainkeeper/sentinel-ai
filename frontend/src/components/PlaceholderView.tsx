export function PlaceholderView({
  title,
  tag,
  description,
}: {
  title: string;
  tag: string;
  description: string;
}) {
  return (
    <article>
      <h1>{title}</h1>
      <p className="placeholder-tag">{tag}</p>
      <p className="placeholder-body">{description}</p>
    </article>
  );
}

export default PlaceholderView;