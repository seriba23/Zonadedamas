interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-12 md:h-16 bg-white border-b border-gray-200 px-3 md:px-6 flex items-center">
      <h1 className="text-base md:text-xl font-semibold text-gray-900">{title}</h1>
    </header>
  );
}
