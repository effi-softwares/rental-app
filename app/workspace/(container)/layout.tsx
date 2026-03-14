function ContainerLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-4 my-6 flex-1 md:mx-6 md:my-8 xl:mx-8">{children}</div>
	)
}

export default ContainerLayout
